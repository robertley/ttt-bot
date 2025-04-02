import { ButtonComponent, ButtonInteraction, Guild, MessageCreateOptions, MessageEditOptions, TextChannel, User } from "discord.js";
import { getAll, getById, set, truncate } from "./database";
import { JuryVote } from "../interfaces/jusy-vote.interface";
import { Player } from "../interfaces/player.interface";
import { ActionResponse } from "../interfaces/action-response.interace";
import { logAction, updateSecretPlayerChannel } from "./bot";


async function createJuryVote(guild: Guild): Promise<void> {
    let channel = guild.channels.cache.get(process.env.JURY_VOTE_CHANNEL_ID) as TextChannel;
    let players = await getAll('player', guild) as Map<string, Player>;
    let alivePlayers = Array.from(players.values()).filter(p => p.health > 0);
    // let message = 'Players:';
    let buttons = [];
    alivePlayers = [
        ...alivePlayers,
        ...alivePlayers,
        ...alivePlayers,
        ...alivePlayers,
        ...alivePlayers,
        ...alivePlayers,
    ]
    for (let player of alivePlayers) {
        buttons.push({
            type: 2,
            style: 2,
            label: `\n${player.emoji} ${player.displayName} 0`,
            custom_id: player.id,
        });
    }

    let removeVoteButton = {
        type: 2,
        style: 4,
        label: 'Remove Vote',
        custom_id: 'remove-vote',
    }

    buttons.push(removeVoteButton);

    // let embed: APIEmbed = {
    //     title: 'Jury Vote',
    //     description: message,
    // }

    let components = [
        {
            type: 1,
            components: buttons,
        }
    ]

    let message: MessageCreateOptions = { content: 'Vote for who will get an extra AP when APs are distributed', components: components };

    await channel.messages.fetch({ limit: 1 }).then(async messages => {
        if (messages.size == 0) {
            await channel.send(message);
            return;
        }
        let messageArray = Array.from(messages.values());
        await messageArray[0].edit(message as MessageEditOptions);
    });
}

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

    let buttons = interaction.message.components[0].components as ButtonComponent[];
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

// TODO any player with three votes gets the bonus AP
async function finalizeJuryVote(guild: Guild): Promise<ActionResponse> {
    let response: ActionResponse = {
        action: 'jury-vote',
        success: true,
        error: null,
    }

    let votes = await getAll('jury-vote', guild) as Map<string, JuryVote>;
    let voteCount = countVotes(votes);
    // console.log(voteCount);
    let winners = [];
    let winnerCount = 0;
    for (let [playerId, count] of voteCount) {
        if (count == winnerCount) {
            winners.push(playerId);
            continue;
        }
        if (count > winnerCount) {
            winners.length = 0;
            winnerCount = count;
            winners.push(playerId);
        }
    }

    if (winners.length != 1) {
        response.action = 'jury-fail';
    } else {
        let winner = await getById('player', guild, winners[0]) as Player;
        winner.actionPoints++;
        response.player = winner;
        await set('player', guild, winner);
        await updateSecretPlayerChannel(guild, winner);
    }

    await logAction(guild.client, response);

    await truncate('jury-vote', guild);
    // await createJuryVote(guild);

    return response;
}

function countVotes(votes: Map<string, JuryVote>): Map<string, number> {
    let voteCount = new Map<string, number>();
    votes.forEach((vote) => {
        if (vote.vote == 'remove-vote') {
            return;
        }
        let count = voteCount.get(vote.vote);
        if (count == null) {
            count = 0;
        }
        count++;
    voteCount.set(vote.vote, count);
    });
    return voteCount;
}

async function addPlayerToJury(guild: Guild, player: Player): Promise<void> {
    let juryChannel = guild.client.channels.cache.get(process.env.JURY_CHANNEL_ID) as TextChannel;
    let message = `Welcome to the jury, <@${player.id}>!`;
    await juryChannel.send(message);

    let juryMemebers = guild.roles.cache.get(process.env.JURY_ROLE_ID).members;
    if (juryMemebers.size < 3) {
        message =  'Waiting for three Jury members to start voting.';
    }
    if (juryMemebers.size == 3) {
        message = 'Three members of the jury have been assembled. You must all vote for the same player for them to recieve the bonus AP. You will be notified when a vote has started.';
    }
    if (juryMemebers.size > 3) {
        message = `${juryMemebers.size} members of the jury have been assembled. The player with the most votes AND at least 3 votes will recieve the bonus AP. You will be notified when a vote has started.`;
    }
    await juryChannel.send(message);
}

async function getVoteCount(guild: Guild): Promise<number> {
    let votes = await getAll('jury-vote', guild) as Map<string, JuryVote>;
    let count = 0;
    for (let vote of votes.values()) {
        if (vote.vote != null) {
            count++;
        }
    }
    return count;
}

export { handleVoteButton, finalizeJuryVote, addPlayerToJury, createJuryVote, juryVote, removeVote, getVoteCount }