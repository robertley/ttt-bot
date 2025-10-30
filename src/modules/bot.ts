import { APIEmbed, ButtonComponent, ButtonInteraction, CategoryChannel, ChannelType, Client, ChatInputCommandInteraction, Embed, Guild, GuildChannel, Interaction, MessageComponentInteraction, MessageCreateOptions, MessageEditOptions, PermissionFlagsBits, TextChannel, User } from "discord.js";
import { drawBoard, drawBoardCanvas, drawPlayerBoard } from "./board";
import { getAll, getById, set } from "./database";
import { Player } from "../interfaces/player.interface";
import { ActionResponse, AttackData, JuryData, MoveData } from "../interfaces/action-response.interace";
import { death, getPlayerStatsEmbed } from "./player";
import { send } from "process";
import { getDeleteMeButton } from "./functions";
import { ScheduledJob, scheduleServerJob } from "./scheduler";
import { queueService } from "./queue-service";
import { SecretChannelCategory } from "../interfaces/secret-channel-category.interface";
import { defer, Observable, Observer, Subject, Subscription } from "rxjs";
import { Game } from "../interfaces/game.interface";

function updateBoardChannel(guild: Guild): Observable<void> {
    return new Observable<void>(sub => {
        console.log('update board channel')

        let client = guild.client;
        getById('game', guild, '1').then(dbObj => {
            let game = dbObj as Game;
                    // let boardEmbed: Partial<Embed>;
            drawBoardCanvas(guild, {}).subscribe((board) => {

                getAll('player', guild).then((players: Map<string, Player>) => {

                    let alivePlayers = Array.from(players.values()).filter(p => p.health > 0);
                    let deadPlayers = Array.from(players.values()).filter(p => p.health == 0);
            
                    let totalPlayers = alivePlayers.length + deadPlayers.length;
            
                    alivePlayers.sort((a, b) => {
                        if (a.range > b.range) {
                            return -1;
                        }
                        if (a.range < b.range) {
                            return 1;
                        }
                        if (a.health > b.health) {
                        return -1;
                        }
                        if (a.health < b.health) {
                            return 1;
                        }
                        return 0;
                    });
            
                    deadPlayers.sort((a, b) => {
                        let aDiedDate = a.diedDate;
                        let bDiedDate = b.diedDate;
                        if (aDiedDate < bDiedDate) {
                            return -1;
                        }
                        if (aDiedDate > bDiedDate) {
                            return 1;
                        }
                    });
            
            
                    let headers = ['', 'R', '<3', 'K', ''];
                    let colLengths = [];
            
                    for (let header of headers) {
                        colLengths.push(header.length);
                    }
            
                    let maxNameLength = 7;
            
                    for (let player of alivePlayers) {
                        if (player.displayName.length > colLengths[0]) {
                            colLengths[0] = Math.min(player.displayName.length, maxNameLength);
                        }
            
                        // if (player.kills.length > colLengths[3]) {
                        //     colLengths[3] = player.kills.length;
                        // }
                    }
            
                    let playerString = '```';
                    let pad = ' ';
            
            
            
                    playerString += `${headers[0].padEnd(colLengths[0], pad)} | ${headers[1].padEnd(colLengths[1], pad)} | ${headers[2].padEnd(colLengths[2], pad)} | ${headers[3].padEnd(colLengths[3], pad)} | ${headers[4].padEnd(colLengths[4], pad)}\n`;
                    for (let player of alivePlayers) {
                        let healthString = player.health.toString();
                        if (player.health == 0) {
                            healthString = 'DEAD';
                        }
            
                        playerString += `${player.displayName.padEnd(colLengths[0], pad).slice(0, maxNameLength)} | ${player.range.toString().padEnd(colLengths[1], pad)} | ${player.health.toString().padEnd(colLengths[2], pad)} | ${player.kills.length} | ${player.emoji}\n`;
                    }
            
                    playerString += '```';
            
                    let embeds = [];
                    
                    let playerEmbed: Partial<Embed> = {
                        title: "Players",
                        description: playerString,
                    }
            
                    embeds.push(playerEmbed);
            
                    let juryEmbed;
            
                    if (deadPlayers.length > 0) {
                        let deadString = '```';
                        let deadStrings = [];
                        for (let player of deadPlayers) {
                            let place = totalPlayers - deadPlayers.indexOf(player);
                            let placeString;
                            if (place == 1) {
                                placeString = '1st';
                            }
                            else if (place == 2) {
                                placeString = '2nd';
                            }
                            else if (place == 3) {
                                placeString = '3rd';
                            } else {
                                placeString = `${place}th`;
                            }
                            deadStrings.push(`${placeString} | ${player.displayName} ${player.emoji}\n`);
                        }
                        deadStrings.reverse();
                        deadString += deadStrings.join('');
                        deadString += '```';
                        juryEmbed = {
                            title: 'Jury',
                            description: deadString,
                        }
                    }
            
                    if (juryEmbed != null) {
                        embeds.push(juryEmbed);
                    }
            
                    let files = [];
                    if (board != null) {
                        files.push(board);
                    }
            
                    let channel = client.channels.cache.get(process.env.BOARD_CHANNEL_ID) as TextChannel;
                    channel.messages.fetch({ limit: 1 }).then(messages => {
                        if (messages.size == 0) {
                            channel.send({ files: files, embeds: embeds});
                            return;
                        }
                        let messageArray = Array.from(messages.values());
                        messageArray[0].edit({ files: files, embeds: embeds});
                    });
                });
            });
        });
    })
    
    // return board;
}

function logAction(client: Client, action: ActionResponse): Observable<void> {
    return new Observable<void>((sub) => {
        if (action.success == false) {
            sub.next();
            return;
        }

        let actionMessage = '';
        if (action.player != null) {
            let player = action.player;
            actionMessage = `${player.emoji} <@${player.id}>`;
        }

        let data;

        switch (action.action) {
            case 'new-game':
                actionMessage = `<@&${process.env.PLAYER_ROLE_ID}> New game started, good luck!`;
                break;
            case 'move':
                data = action.data as MoveData;
                actionMessage += ` moved`;
                actionMessage += ` ${data.direction}`;
                break;
            case 'attack':
                data = action.data as AttackData;
                actionMessage += ` attacked ${data.target.emoji} <@${data.target.id}>`;
                break;
            case 'death':
                actionMessage += ` died 💀`;
                break;
            case 'scheduled-ap':
                actionMessage = `<@&${process.env.PLAYER_ROLE_ID}> Action Points have been distributed`;
                break;
            case 'range-upgrade':
                actionMessage += ` upgraded their range ${action.player.range - 1} -> ${action.player.range}`;
                break;
            case 'heal':
                actionMessage += ` gained a heart ${action.player.health - 1} -> ${action.player.health}`;
                break;
            case 'jury-vote':
                let playersMessages = [];
                for (let player of (action.data  as JuryData).winners) {
                    playersMessages.push(`${player.emoji} <@${player.id}>`);
                }
                let playersString = playersMessages.join(', ');
                actionMessage = `The <@&${process.env.JURY_ROLE_ID}> has awarded ${playersString} an extra AP`;
                break;
            case 'jury-fail':
                actionMessage = `The <@&${process.env.JURY_ROLE_ID}> failed to award an extra AP`;
                break;

        }
        let channel = client.channels.cache.get(process.env.LOG_CHANNEL_ID) as TextChannel;

        let boardCanvas = null;
        if (action.action == 'move' || action.action == 'attack') {
            drawBoardCanvas(channel.guild, {
                actionResponse: action,
            }).subscribe((board) => {
                boardCanvas = board;
                channel.send({ content: actionMessage, files: [board] }).then(() => {
                    sub.next();
                    sub.complete();
                });
            });
            return;
        }

        if (action.action == 'range-upgrade') {
            drawBoardCanvas(channel.guild, {
                player: action.player
            }).subscribe((board) => {
                boardCanvas = board;
                channel.send({ content: actionMessage, files: [board] }).then(() => {
                    sub.next();
                    sub.complete();
                });
            });
            return;
        }

        channel.send({ content: actionMessage  }).then(() => {
            sub.next();
            sub.complete();
        });
    });
    
}

async function createSecretPlayerChannel(guild: Guild, player: Player): Promise<string> {

    let channel = await guild.channels.create({
        name: `commands-${player.emoji}-${player.displayName}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: player.id,
                allow: [PermissionFlagsBits.ViewChannel],
            },
        ],
    });

    setTimeout(async () => {
        await updateSecretPlayerChannel(guild, player);
    });

    return channel.id;
}

async function createNotifcationPlayerChannel(guild: Guild, player: Player): Promise<string> {

    let channel = await guild.channels.create({
        name: `notifcations-${player.emoji}-${player.displayName}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: player.id,
                allow: [PermissionFlagsBits.ViewChannel],
            },
        ],
    });

    return channel.id;
}

const MAX_CHANNELS_PER_CATEGORY = 50;

async function createSecretGroupChannel(guild: Guild, user: User, name: string): Promise<void> {
    // let secretCategory = guild.channels.cache.get(process.env.SECRET_CATEGORY_ID) as CategoryChannel;
    let secretChannelGroups = await getAll('secret-channel-category', guild) as Map<string, SecretChannelCategory>;
    if (secretChannelGroups.size == 0) {
        let newCategory = await newSecretChannelCategory(guild);
        let newGroup: SecretChannelCategory = {
            id: newCategory.id,
            full: false,
        }
        secretChannelGroups.set(newGroup.id, newGroup);
        await set('secret-channel-category', guild, newGroup);
    }
    let secretCategoryGroup = Array.from(secretChannelGroups.values()).find(c => c.full == false);
    if (secretCategoryGroup == null) {
        let newCategory = await newSecretChannelCategory(guild);
        let newGroup: SecretChannelCategory = {
            id: newCategory.id,
            full: false,
        }
        secretChannelGroups.set(newGroup.id, newGroup);
        secretCategoryGroup = newGroup;
        await set('secret-channel-category', guild, newGroup);
    }

    let channel = await guild.channels.create({
        name: name,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: user.id,
                allow: [PermissionFlagsBits.ViewChannel],
            },
        ],
        parent: secretCategoryGroup.id,
    })

    let size = await channel.parent.children.cache.filter(c => c.type == ChannelType.GuildText).size;
    if (size >= MAX_CHANNELS_PER_CATEGORY) {
        secretCategoryGroup.full = true;
        await set('secret-channel-category', guild, secretCategoryGroup);
    }

    return;
}

async function newSecretChannelCategory(guild: Guild): Promise<CategoryChannel> {
    let category: CategoryChannel = await guild.channels.create({
        name: 'Secret Channels',
        type: ChannelType.GuildCategory
    });
    return category;
}

async function addUserToSecretChannel(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    let channel = interaction.channel as TextChannel;
    if (channel.parent.id != process.env.SECRET_CATEGORY_ID && channel.parent.id != process.env.SECRET_CATEGORY_ID_2) {
        await interaction.editReply({ content: 'This is not a secret channel' });
        return;
    }
    await channel.permissionOverwrites.edit(
        user,
        {
            ViewChannel: true,
        }
    );

    let invitee = await getById('player', interaction.guild, user.id) as Player;
    let player = await getById('player', interaction.guild, interaction.user.id) as Player;

    await sendPlayerNotification(interaction.guild, invitee, `<@${player.id}> has added you to the secret channel ${channel.name}`);
    return;
}

async function removeUserFromSecretChannel(interaction: ChatInputCommandInteraction, user: User): Promise<void> {
    let channel = interaction.channel as TextChannel;
    if (channel.parent.id != process.env.SECRET_CATEGORY_ID && channel.parent.id != process.env.SECRET_CATEGORY_ID_2) {
        await interaction.editReply({ content: 'This is not a secret channel' });
        return;
    }
    await channel.permissionOverwrites.edit(
        user,
        {
            ViewChannel: false,
        }
    );
}


function updateSecretPlayerChannel(guild: Guild, player: Player): Observable<TextChannel> {
    return new Observable<TextChannel>((sub) => {
        let channelId = player.secretChannelId;
        let channel = guild.channels.cache.get(channelId) as TextChannel;
        let playerEmbed = getPlayerStatsEmbed(player);
        getById('game', guild, '1').then((dbObj) => {
            let game = dbObj as Game;

            let files = [];
            if (game != null) {
                drawBoardCanvas(guild, {
                    player: player,
                }).subscribe((playerBoard) => {
                    files.push(playerBoard);

                    // get first message
                    channel.messages.fetch().then(messages => {
                        let messageArray = Array.from(messages.values());
                        let killsMessage = null;
                        if (player.kills.length > 0) {
                            killsMessage = `Kills: ${player.kills.join(' ')}`;
                        }
                        if (messageArray.length == 0) {
                            channel.send({ embeds: [playerEmbed], files: files, content: killsMessage }).then(() => {
                                addPlayerControlButtons(guild, player).subscribe(() => {
                                    sub.next(channel);
                                    sub.complete();
                                });
                            });
                            return;
                        }
                        let targetMessage = messageArray[messageArray.length - 1];
                        targetMessage.edit({ files: files, embeds: [playerEmbed], content: killsMessage }).then(() => {
                        });

                        sub.next(channel);
                        sub.complete();
                    });
                    
                });
            }
        });
    });
}

function addPlayerControlButtons(guild: Guild, player: Player): Observable<void> {
    return new Observable<void>((sub) => {
        let channel = guild.channels.cache.get(player.secretChannelId) as TextChannel;

        let moveButton = {
            type: 2,
            style: 1,
            label: 'Move',
            custom_id: `ap-movePanel`,
        }

        let attackButton = {
            type: 2,
            style: 1,
            label: 'Attack',
            custom_id: `ap-attackPanel`,
        }

        let sendAPButton = {
            type: 2,
            style: 1,
            label: 'Send AP',
            custom_id: `ap-sendApPanel`,
        }

        let upgradeRangeButton = {
            type: 2,
            style: 1,
            label: 'Upgrade Range',
            custom_id: `ap-upgradeRangePanel`,
        }

        let healButton = {
            type: 2,
            style: 1,
            label: 'Gain Heart',
            custom_id: `ap-healPanel`,
        }

        channel.send({ content: 'Actions', components: [{type: 1, components: [moveButton, attackButton, sendAPButton, upgradeRangeButton, healButton]}]}).then(() => {
            sub.next();
            sub.complete();
        });
    });
}


function updateAllSecretPlayerChannels(guild: Guild): Observable<void> {
    return new Observable<void>((sub) => {
        getAll('player', guild).then((players: Map<string, Player>) => {
            let obs: Observable<TextChannel>[] = []
            for (let player of players.values()) {
                obs.push(updateSecretPlayerChannel(guild, player));
            }

            // wait for all observables to complete
            let completed = 0;
            for (let o of obs) {
                o.subscribe({
                    next: (channel) => {
                        console.log(`Updated channel ${channel.name}`);
                    },
                    complete: () => {
                        completed++;
                        if (completed == obs.length) {
                            sub.next();
                            sub.complete();
                        }
                    }
                });
            }
        });

    });

    // wait 10 seconds

}

async function sendPlayerNotification(guild: Guild, player: Player, message: string): Promise<void> {
    let channel = player.notifcationChannelId;
    let textChannel = guild.channels.cache.get(channel) as TextChannel;

    await textChannel.send({content: message, components: [{type: 1, components: [getDeleteMeButton()]}]});
}

function killPlayerEvents(guild: Guild, player: Player, target: Player): Observable<void> {
    return new Observable<void>((sub) => {

        target.diedDate = Date.now();

        let earnedAP = Math.floor(target.actionPoints / 2);

        let channel = guild.channels.cache.get(player.notifcationChannelId) as TextChannel;
        channel?.send({content: `You have killed ${target.emoji} <@${target.id}>  and earned ${earnedAP} AP`, components: [{type: 1, components: [getDeleteMeButton()]}]});

        death(target, guild.client).subscribe(() => {
            let targetAP = target.actionPoints;
            let earnedAP = Math.floor(targetAP / 2);
            player.actionPoints += earnedAP;
            player.kills.push(target.emoji);

            let channel = guild.channels.cache.get(target.notifcationChannelId) as TextChannel;
            channel?.send({content: `<@${target.id}> You have been killed by <@${player.id}> 💀`, components: [{type: 1, components: [getDeleteMeButton()]}]});

            sub.next();
            sub.complete();
        });
    });
}

async function updateSetting(guild: Guild, key: string, value: string): Promise<void> {
    let settings = await getById('settings', guild, '1');
    settings[key] = value;
    await set('settings', guild, settings);
    await updateSettingsChannel(guild);

    if (key == 'apScheduleCron' || key == 'juryOpenScheduleCron') {
        let job: ScheduledJob = key == 'apScheduleCron' ? 'distributeApJob' : 'juryOpenJob';

        await scheduleServerJob(job, value, guild);
    }
}

async function updateSettingsChannel(guild: Guild): Promise<void> {
    let channel = guild.channels.cache.get(process.env.SETTINGS_CHANNEL_ID) as TextChannel;
    let settings = await getById('settings', guild, '1');
    if (settings == null) {
        return;
    }
    
    // get first message
    let messages = await channel.messages.fetch();
    let messageArray = Array.from(messages.values());
    let settingsMessage = `\`\`\`${JSON.stringify(settings, null, 2)}\`\`\``;
    if (messageArray.length == 0) {
        await channel.send(settingsMessage);
        return;
    }
    let targetMessage = messageArray[messageArray.length - 1];
    await targetMessage.edit(settingsMessage);
}

async function messageInteractionReply(interaction: MessageComponentInteraction, deferSub: Subject<string | void>, message?: string): Promise<void> {
    // console.log(deferSub);
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
    }
    if (deferSub) {
        deferSub.subscribe({
            next: async (resp) => {
                if (message) {
                    await interaction.editReply({ content: message });
                }
                if (typeof resp !== "string") {
                    return;
                }
                await interaction.editReply({ content: resp });
            },
            complete: async () => {
                console.log('Interaction complete');
            }
        })
    } else {
        await interaction.editReply({ content: message ?? '< No response >' });
    }
}

export {
    updateBoardChannel,
    logAction,
    createSecretPlayerChannel,
    createNotifcationPlayerChannel,
    updateSecretPlayerChannel,
    updateAllSecretPlayerChannels,
    createSecretGroupChannel,
    addUserToSecretChannel,
    removeUserFromSecretChannel,
    killPlayerEvents,
    updateSettingsChannel,
    updateSetting,
    messageInteractionReply
};