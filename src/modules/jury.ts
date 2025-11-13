import { ButtonComponent, ButtonInteraction, Guild, MessageCreateOptions, MessageEditOptions, TextChannel, User } from "discord.js";
import { getAll, getById, set, truncate } from "./database";
import { JuryVote } from "../interfaces/jusy-vote.interface";
import { Player } from "../interfaces/player.interface";
import { ActionResponse } from "../interfaces/action-response.interace";
import { Bot } from "./bot";
import { Settings } from "../interfaces/settings.interface";
import { Observable } from "rxjs";

async function juryVote(guild: Guild, player: User, candidate: User) {
    let vote = candidate.id;
    let user = player;

    await set('jury-vote', guild, { id: user.id, vote: vote } as JuryVote);

    // let votes = await getAll('jury-vote', guild) as Map<string, JuryVote>;
}

async function removeVote(guild: Guild, player: User) {
    await set('jury-vote', guild, { id: player.id, vote: null } as JuryVote);
}

async function handleVoteButton(interaction: ButtonInteraction): Promise<void> {

    let vote = interaction.customId;
    let user = interaction.user;
    let guild = interaction.guild;
    let players = await getAll('player', guild) as Map<string, Player>;
    let alivePlayers = Array.from(players.values()).filter((player) => player.health > 0);

    if (vote == 'remove-vote') {
        vote == null;
    }

    await set('jury-vote', guild, { id: user.id, vote: vote } as JuryVote);

    let votes = await getAll('jury-vote', guild) as Map<string, JuryVote>;

    let voteCount = countVotes(votes);

    // console.log(voteCount);

    let buttons = (interaction.message.components[0] as any).components as ButtonComponent[];
    let newButtons = buttons.map((button) => {
        if (button.customId == 'remove-vote') {
            return {
                type: 2,
                style: 4,
                label: 'Remove Vote',
                customId: 'remove-vote',
                disabled: false,
            };
        }

        let player = alivePlayers.find((player) => player.id == button.customId);
        let count = voteCount.get(player.id);
        if (count == null) {
            count = 0;
        }
        return {
            type: 2,
            style: 2,
            label: `${player.emoji} ${player.displayName} ${count}`,
            customId: player.id,
            disabled: false,
        };
    });
    await interaction.update({ components: [{ type: 1, components: newButtons }] });

    
}

async function finalizeJuryVote(guild: Guild): Promise<ActionResponse> {
    let response: ActionResponse = {
        action: 'jury-vote',
        success: true,
        error: null,
    }

    let votes = await getAll('jury-vote', guild) as Map<string, JuryVote>;
    let voteCount = countVotes(votes);
    let winners = [];
    let votesRequired = await getJuryVotesRequired(guild).toPromise();
    for (let [playerId, count] of voteCount) {
        if (count >= votesRequired) {
            winners.push(playerId);
        }
    }

    if (winners.length < 1) {
        response.action = 'jury-fail';
    }

    response.data = {
        winners: [],
    }
    for (let winnerId of winners) {
        let winner = await getById<Player>('player', guild, winnerId) as Player;
        winner.actionPoints++;
        response.data.winners.push(winner);
        await set('player', guild, winner);
    }

    await set('jury-vote-backup', guild, Array.from(votes.values()));
    await truncate('jury-vote', guild);

    await Bot.logAction(guild.client, response).toPromise();

    return response;
}

async function closeJury(guild: Guild): Promise<void> {
    let settings = await getById<Settings>('settings', guild) as Settings;
    // await truncate('jury-vote', guild);
    settings.juryOpen = false;
    await set('settings', guild, settings);
}

function countVotes(votes: Map<string, JuryVote>): Map<string, number> {
    let voteCount = new Map<string, number>();
    for (let vote of votes.values()) {
        if (vote.vote == 'remove-vote') {
            continue;
        }
        let count = voteCount.get(vote.vote);
        if (count == null) {
            count = 0;
        }
        count++;
        voteCount.set(vote.vote, count);
    }
    return voteCount;
}

function addPlayerToJury(guild: Guild, player: Player): Observable<void> {
    return new Observable<void>(sub => {

        getById<Settings>('settings', guild, '1').then(settings => {
            let juryChannel = guild.client.channels.cache.get(process.env.JURY_CHANNEL_ID) as TextChannel;
            let message = `Welcome to the jury, <@${player.id}>!`;
            juryChannel.send(message).then(() => {
                let juryMembers = guild.roles.cache.get(process.env.JURY_ROLE_ID).members;
                getJuryVotesRequired(guild).subscribe((votesRequired) => {
                    if (votesRequired == null) {
                        message =  `Waiting for ${settings.juryMin3Votes} Jury members to start voting.`;
                    } else {
                        message = `${juryMembers.size} members of the jury have been assembled. Any player with at least **${votesRequired}** votes will recieve one bonus AP. You will be notified when a vote has started.`;
                    }

                    juryChannel.send(message);

                    sub.next();
                    sub.complete();
                });

            });
        }).catch((error) => {
            sub.error(error)
            sub.complete()
        });

    });
}

function getJuryVotesRequired(guild: Guild): Observable<number> {
    return new Observable<number>(sub => {
        getById<Settings>('settings', guild, '1').then(async settings => {
            let players = await getAll<Player>('player', guild);
            let juryMembers = Array.from(players.values()).filter(player => {
                return player.health < 1;
            });
            let amt = null;
            if (juryMembers.length < settings.juryMin3Votes) {
                amt = null;
            }
            else if (juryMembers.length < settings.juryMin4Votes) {
                amt = 3;
            }
            else if (juryMembers.length < settings.juryMin5Votes) {
                amt = 4;
            } else {
                amt = 5;
            }
            sub.next(amt);
            sub.complete();
        }).catch((error) => {
            sub.error(error)
            sub.complete()
        });
    });
}

function getVoteCount(guild: Guild): Observable<{votes: number, votesRequired: number}> {
    return new Observable<{votes: number, votesRequired: number}>(sub => {
        getAll<JuryVote>('jury-vote', guild).then(votes => {
            getJuryVotesRequired(guild).subscribe((votesRequired) => {
                let count = 0;
                for (let vote of votes.values()) {
                    if (vote.vote != null) {
                        count++;
                    }
                }
                sub.next({ votes: count, votesRequired: votesRequired });
                sub.complete();
            });
        }).catch((error) => {
            sub.error(error)
            sub.complete()
        });
    });
}

export const Jury = { handleVoteButton, finalizeJuryVote, addPlayerToJury, juryVote, removeVote, getVoteCount, closeJury }