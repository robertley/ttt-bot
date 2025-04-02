import { APIEmbed, ButtonComponent, CategoryChannel, ChannelType, Client, CommandInteraction, Embed, Guild, GuildChannel, MessageCreateOptions, MessageEditOptions, PermissionFlagsBits, TextChannel, User } from "discord.js";
import { drawBoard, drawBoardCanvas, drawPlayerBoard } from "./board";
import { getAll, getById, set } from "./database";
import { Player } from "../interfaces/player.interface";
import { ActionResponse, AttackData, MoveData } from "../interfaces/action-response.interace";
import { death, getPlayerStatsEmbed } from "./player";
import { send } from "process";
import { getDeleteMeButton } from "./functions";
import { ScheduledJob, scheduleServerJob } from "./scheduler";
import { queueService } from "../commands/system/queue-service";

async function doActionEvents(opts: {
    guild: Guild,
    user: User,
    target?: User,
    actionResponse?: ActionResponse
}): Promise<void> {

    let { guild, user, target, actionResponse } = opts;

    let player = await getById('player', guild, user.id) as Player;
    queueService.addToQueue(() => 
        updateBoardChannel(guild), 5,
    'update-board-channel');
    await updateSecretPlayerChannel(guild, player);
    
    let channel;

    if (target != null) {
        let targetUser = await getById('player', guild, target.id) as Player;
        channel = await updateSecretPlayerChannel(guild, targetUser);
    }

    // if secret action
    if (actionResponse.action == 'give-ap') {
        
        await channel?.send({content: `<@${target.id}> You have been given 1 AP by <@${user.id}>`, components: [{type: 1, components: [getDeleteMeButton()]}]});

        return;
    }

    if (actionResponse != null) {
        await logAction(guild.client, actionResponse);
    }

    if (actionResponse.action == 'attack' && actionResponse.success == true && (actionResponse.data as AttackData).target.health == 0) {
        await killPlayerEvents(guild, player, (actionResponse.data as AttackData).target);
    }
        
}

async function updateBoardChannel(guild: Guild): Promise<Buffer> {
    let client = guild.client;
    let game = await getById('game', guild, '1');
    // let boardEmbed: Partial<Embed>;
    let board;
    if (game != null) {
        board = await drawBoardCanvas(guild);
    }

    let players = await getAll('player', guild) as Map<string, Player>;

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
    await channel.messages.fetch({ limit: 1 }).then(async messages => {
        if (messages.size == 0) {
            await channel.send({ files: files, embeds: embeds});
            return;
        }
        let messageArray = Array.from(messages.values());
        await messageArray[0].edit({ files: files, embeds: embeds});
    });

    return board;
}

async function logAction(client: Client, action: ActionResponse): Promise<void> {
    if (action.success == false) {
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
            actionMessage = `<@&${process.env.PLAYER_ROLE_ID}> The <@&${process.env.JURY_ROLE_ID}> has awarded ${action.player.emoji} <@${action.player.id}> an extra AP`;
            break;
        case 'jury-fail':
            actionMessage = `<@&${process.env.PLAYER_ROLE_ID}> The <@&${process.env.JURY_ROLE_ID}> failed to award an extra AP`;
            break;

    }
    let channel = client.channels.cache.get(process.env.LOG_CHANNEL_ID) as TextChannel;

    let boardCanvas = null;
    if (action.action == 'move' || action.action == 'attack') {
        boardCanvas = await drawBoardCanvas(channel.guild, {
            actionResponse: action,
        });
    }

    if (action.action == 'range-upgrade') {
        let playerBoard = await drawBoardCanvas(channel.guild, {
            player: action.player
        });
        boardCanvas = playerBoard;
    }

    let files = [];
    if (boardCanvas != null) {
        files.push(boardCanvas);
    }

    await channel.send({ content: actionMessage, files: files });
    
}

async function createSecretPlayerChannel(guild: Guild, player: Player): Promise<string> {

    let channel = await guild.channels.create({
        name: `${player.emoji}-${player.displayName}-secret`,
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

        await addPlayerControlButtons(guild, player);
    });

    return channel.id;
}

async function createSecretGroupChannel(guild: Guild, user: User, name: string): Promise<void> {
    let secretCategory = guild.channels.cache.get(process.env.SECRET_CATEGORY_ID) as CategoryChannel;
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
        parent: secretCategory,
    })


    return;
}

async function addUserToSecretChannel(interaction: CommandInteraction, user: User): Promise<void> {
    let channel = interaction.channel as TextChannel;
    if (channel.parent.id != process.env.SECRET_CATEGORY_ID) {
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

async function removeUserFromSecretChannel(interaction: CommandInteraction, user: User): Promise<void> {
    let channel = interaction.channel as TextChannel;
    if (channel.parent.id != process.env.SECRET_CATEGORY_ID) {
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


async function updateSecretPlayerChannel(guild: Guild, player: Player): Promise<TextChannel> {
    let channelId = player.secretChannelId;
    let channel = guild.channels.cache.get(channelId) as TextChannel;
    let playerEmbed = await getPlayerStatsEmbed(player);
    let game = await getById('game', guild, '1');
    let files = [];
    if (game != null) {
        let playerBoard = await drawBoardCanvas(guild, {
            player: player,
        });
        files.push(playerBoard);
    }

    // get first message
    let messages = await channel.messages.fetch();
    let messageArray = Array.from(messages.values());
    let killsMessage = null;
    if (player.kills.length > 0) {
        killsMessage = `Kills: ${player.kills.join(' ')}`;
    }
    if (messageArray.length == 0) {
        await channel.send({ embeds: [playerEmbed], files: files, content: killsMessage });
        return channel;
    }
    let targetMessage = messageArray[messageArray.length - 1];
    await targetMessage.edit({ files: files, embeds: [playerEmbed], content: killsMessage });
    return channel;
}

async function addPlayerControlButtons(guild: Guild, player: Player): Promise<void> {
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

    await channel.send({ content: 'Actions', components: [{type: 1, components: [moveButton, attackButton, sendAPButton, upgradeRangeButton, healButton]}]});

}


async function updateAllSecretPlayerChannels(guild: Guild): Promise<void> {
    let players = await getAll('player', guild) as Map<string, Player>;
    for (let player of players.values()) {
        await updateSecretPlayerChannel(guild, player);
    }
}

async function sendPlayerNotification(guild: Guild, player: Player, message: string): Promise<void> {
    let channel = player.secretChannelId;
    let textChannel = guild.channels.cache.get(channel) as TextChannel;

    await textChannel.send({content: message, components: [{type: 1, components: [getDeleteMeButton()]}]});
}

async function killPlayerEvents(guild: Guild, player: Player, target: Player): Promise<void> {

    target.diedDate = new Date();

    await death(target, guild.client);

    let targetAP = target.actionPoints;
    let earnedAP = Math.floor(targetAP / 2);
    player.actionPoints += earnedAP;
    player.kills.push(target.emoji);
    
    await set('player', guild, player);

    let targetUser = guild.members.cache.get(target.id).user;


    await doActionEvents({
        guild: guild,
        user: targetUser,
        actionResponse: {
            success: true,
            error: null,
            message: null,
            player: target,
            action: 'death',
            data: null,
        }
    });


    await sendPlayerNotification(guild, player, `You have killed ${target.emoji} <@${target.id}> and earned ${earnedAP} AP`);
    await sendPlayerNotification(guild, target, `You have been killed by ${player.emoji} <@${player.id}>`);

    await updateSecretPlayerChannel(guild, player);
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

export {
    updateBoardChannel,
    logAction,
    createSecretPlayerChannel,
    doActionEvents,
    updateSecretPlayerChannel,
    updateAllSecretPlayerChannels,
    createSecretGroupChannel,
    addUserToSecretChannel,
    removeUserFromSecretChannel,
    killPlayerEvents,
    updateSettingsChannel,
    updateSetting
};