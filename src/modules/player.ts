import { ButtonInteraction, Client, Embed, Guild, TextChannel, User } from "discord.js";
import { Player } from "../interfaces/player.interface";
import { set, getById, getAll } from "./database";
import { ActionResponse } from "../interfaces/action-response.interace";
import { Board } from "../interfaces/board.interface";
import { createSecretPlayerChannel, doActionEvents, killPlayerEvents, updateAllSecretPlayerChannels } from "./bot";
import { tileIsInRange } from "./board";
import { addPlayerToJury } from "./jury";
import { getDeleteMeButton } from "./functions";
import { queueService } from "../commands/system/queue-service";

async function createNewPlayer(user: User, guild: Guild, emoji): Promise<Player> {
    let existingPlayer = await getById('player', guild, user.id) as Player;
    if (existingPlayer != null) {
        existingPlayer.emoji = emoji;
        await set('player', guild, existingPlayer);
        return existingPlayer;
    }

    let player: Player = {
        id: user.id,
        displayName: user.displayName,
        actionPoints: 0,
        health: 3,
        range: 2,
        emoji: emoji,
        secretChannelId: null,
        diedDate: null,
        kills: [],
        brainOrBrawn: null
    }

    player.secretChannelId = await createSecretPlayerChannel(guild, player);

    // give user PLAYER role
    let role = await guild.roles.fetch(process.env.PLAYER_ROLE_ID);
    await guild.members.fetch(user.id).then(member => {
        member.roles.add(role);
    });


    // update user server nickname to include emoji
    await guild.members.fetch(user.id).then(async member => {
        // doesnt work on admins
        try {
            await member.setNickname(`${user.displayName} ${emoji}`);
        } catch (e) {
            console.log(e);
        }
    
    });


    set('player', guild, player);

    return player;
}

async function handleAPButton(interaction: ButtonInteraction) {
    let action = interaction.customId.split('-')[1];
    let actionSecondary = interaction.customId.split('-')[2];
    // console.log(interaction.user);
    let resp;
    let message;
    let targetUser;
    switch (action) {
        case 'movePanel':
            await openMovePanel(interaction);
            return;
        case 'attackPanel':
            await openAttackSendAPPanel(interaction, 'attack');
            return;
        case 'sendApPanel':
            await openAttackSendAPPanel(interaction, 'sendAp');
            return;
        case 'upgradeRangePanel':
            await confirmPanel(interaction, 'upgradeRange');
            return;
        case 'healPanel':
            await confirmPanel(interaction, 'heal');
            return;
        case 'move':
            resp = await move(interaction.user, actionSecondary as 'up' | 'down' | 'left' | 'right', interaction.guild);
            break;
        case 'attack':
            targetUser = interaction.guild.members.cache.get(actionSecondary).user;
            resp = await attack(interaction.user, targetUser, interaction.guild);
            break;
        case 'sendAp':
            targetUser = interaction.guild.members.cache.get(actionSecondary).user;
            resp = await giveAP(interaction.user, targetUser, interaction.guild);
            break;
        case 'upgradeRange':
            resp = await upgradeRange(interaction.user, interaction.guild);
            break;
        case 'heal':
            resp = await addHeart(interaction.user, interaction.guild);
            break;
        // case 'range':
        //     rangeButton(interaction, actionSecondary);
        //     break;
        // case 'give-ap':
        //     giveAPButton(interaction, actionSecondary);
        //     break;
        default:
            message = 'Invalid action';
            await interaction.editReply({ content: message });
            return;
    }

    if (!resp.success) {
        message = `Could not ${action}: ${resp.error} - ${resp.message}`;
        await interaction.editReply({ content: message });
        return;
    }

    switch (action) {
        case 'move':
            message = `Moved ${actionSecondary}!`;
            break;
        case 'attack':
            message = `Attacked ${resp.data.target.displayName}!`;
            break;
        case 'sendAp':
            message = `Sent an AP to ${resp.data.target.displayName}!`;
            break;
        case 'upgradeRange':
            message = `Range upgraded!`;
            break;
        case 'heal':
            message = `Added a heart!`;
            break;
    }

    message +=  ` AP remaining: ${resp.player.actionPoints}`;

    queueService.addHighPriority(() =>
        doActionEvents({
            guild: interaction.guild, 
            user: interaction.user, 
            target: targetUser,
            actionResponse: resp
        })
    );

    if (action == 'move') {
        queueService.addLowPriority(() =>
            updateAllSecretPlayerChannels(interaction.guild),
        'secret-player-channel-update');
    }

    await interaction.editReply({ content: message });
}

async function openAttackSendAPPanel(interaction: ButtonInteraction, type: 'attack' | 'sendAp') {
    let player = await getById('player', interaction.guild, interaction.user.id) as Player;
    let inRangePlayers = await getInRangePlayers(player, interaction.guild);

    if (inRangePlayers.length == 0) {
        await interaction.editReply({ content: 'No players in range' });
        return;
    }

    let buttons = [];
    for (let p of inRangePlayers) {
        buttons.push({
            label: `${p.displayName} ${p.emoji}`,
            custom_id: `ap-${type}-${p.id}`,
            style: 1,
            type: 2
        });
    }

    let buttonGroups = [];
    // split buttons into groups of 5 -- 4 if delete me button
    while (buttons.length > 0) {
        buttonGroups.push(buttons.splice(0, 5));
    }

    let message = `Select a player to ${type == 'attack' ? 'attack' : 'send an AP'}`;
    if (buttonGroups.length == 0) {
        await interaction.editReply({ content: message, components: [{type: 1, components: buttonGroups[0]}] });
    }
    for (let i in buttonGroups) {
        let group = buttonGroups[i];
        if (+i == 0) {
            await interaction.editReply({ content: message, components: [{type: 1, components: group}] });
            continue;
        }
        await interaction.followUp({components: [{type: 1, components: group}], ephemeral: true })
    }
    
}

async function openMovePanel(interaction: ButtonInteraction) {
    let leftButton = {
        type: 2,
        style: 1,
        label: 'Left',
        custom_id: `ap-move-left`,
    }
    let rightButton = {
        type: 2,
        style: 1,
        label: 'Right',
        custom_id: `ap-move-right`,
    }
    let upButton = {
        type: 2,
        style: 1,
        label: 'Up',
        custom_id: `ap-move-up`,
    }
    let downButton = {
        type: 2,
        style: 1,
        label: 'Down',
        custom_id: `ap-move-down`,
    }

    await interaction.editReply({ content: 'Choose a direction', components: [{type: 1, components: [leftButton, rightButton, upButton, downButton]}]});
}

async function confirmPanel(interaction: ButtonInteraction, action: 'upgradeRange' | 'heal') {
    let confirmButton = {
        type: 2,
        style: 1,
        label: 'Confirm',
        custom_id: `ap-${action}`,
    }

    await interaction.editReply({ content: `Confirm ${action == 'upgradeRange' ? 'upgrade your range' : 'add a heart'}?`, components: [{type: 1, components: [confirmButton]}]});
}

async function getInRangePlayers(player: Player, guild: Guild): Promise<Player[]> {
    let board = await getById('board', guild, '1') as Board;
    let playerMap = await getAll('player', guild) as Map<string, Player>;
    let otherPlayers = Array.from(playerMap.values()).filter(p => p.id != player.id && p.health > 0);
    let inRangePlayers = [];
    for (let oPlayer of otherPlayers) {
        if (await playerIsInRange(board, player, oPlayer)) {
            inRangePlayers.push(oPlayer);
        }
    }

    return inRangePlayers;
}

async function move(user: User, direction: 'up' | 'down' | 'left' | 'right', guild: Guild): Promise<ActionResponse> {
    let player: Player = await getById('player', guild, user.id) as Player;

    if (aliveCheck(player) == false) {
        return {
            success: false,
            error: 'invalid',
            message: 'You are dead',
            player: player,
            action: 'move',
            data: null
        }
    }

    let action: ActionResponse = {
        success: true,
        error: null,
        message: null,
        player: player,
        action: 'move',
        data: {
            direction: direction
        }
    }
    
    if (player.actionPoints < 1) {
        action.success = false;
        action.error = 'no energy';
        action.message = 'You do not have enough energy to move';
        return action;
    }

    let board = await getById('board', guild, '1') as Board;
    for (let i = 0; i < board.tile.length; i++) {
        for (let j = 0; j < board.tile[i].length; j++) {
            if (board.tile[i][j] == user.id) {
                var playerPosition = {x: i, y: j};
                break;
            }
        }
    }
    let newPosition = {x: playerPosition.x, y: playerPosition.y};

    switch (direction) {
        case 'up':
            newPosition.y--;
            break;
        case 'down':
            newPosition.y++;
            break;
        case 'left':
            newPosition.x--;
            break;
        case 'right':
            newPosition.x++;
            break;
    }

    // check if new position is out of bounds and wrap around
    if (newPosition.x < 0) {
        newPosition.x = board.tile.length - 1;
    } else if (newPosition.x >= board.tile.length) {
        newPosition.x = 0;
    }
    if (newPosition.y < 0) {
        newPosition.y = board.tile[0].length - 1;
    }
    if (newPosition.y >= board.tile[0].length) {
        newPosition.y = 0;
    }

    if (board.tile[newPosition.x][newPosition.y] != null) {
        action.success = false;
        action.error = 'invalid';
        action.message = 'Cannot move to a tile with another player';
        return action;
    }

    player.actionPoints--;

    board.tile[playerPosition.x][playerPosition.y] = null;
    board.tile[newPosition.x][newPosition.y] = player.id;

    await set('player', guild, player);
    await set('board', guild, board);

    action.success = true;
    return action;
}

async function attack(user: User, target: User, guild: Guild): Promise<ActionResponse> {
    let player = await getById('player', guild, user.id) as Player;
    if (aliveCheck(player) == false) {
        return {
            success: false,
            error: 'invalid',
            message: 'You are dead',
            player: player,
            action: 'attack',
            data: null
        }
    }
    let targetPlayer = await getById('player', guild, target.id) as Player;

    let action: ActionResponse = {
        success: true,
        error: null,
        message: null,
        player: player,
        action: 'attack',
        data: {
            target: targetPlayer
        }
    }

    if (player.actionPoints < 1) {
        action.success = false;
        action.error = 'no energy';
        action.message = 'You do not have enough energy to attack';
        return action;
    }

    if (targetPlayer.health == 0) {
        action.success = false;
        action.error = 'invalid';
        action.message = 'target is dead';
        return action;
    }

    let board = await getById('board', guild, '1') as Board;

    let inRange = await playerIsInRange(board, player, targetPlayer);

    if (!inRange) {
        action.success = false;
        action.error = 'invalid';
        action.message = 'Target is out of range';
        return action;
    }

    targetPlayer.health--;
    player.actionPoints--;

    await set('player', guild, player);
    await set('player', guild, targetPlayer);

    return action;
}

async function playerIsInRange(board: Board, player: Player, target: Player): Promise<boolean> {
    for (let i = 0; i < board.tile.length; i++) {
        for (let j = 0; j < board.tile[i].length; j++) {
            if (board.tile[i][j] == player.id) {
                var playerPosition = {x: i, y: j};
                break;
            }
        }
    }

    for (let i = 0; i < board.tile.length; i++) {
        for (let j = 0; j < board.tile[i].length; j++) {
            if (board.tile[i][j] == target.id) {
                var targetPosition = {x: i, y: j};
                break;
            }
        }
    }

    return tileIsInRange(targetPosition.x, targetPosition.y, playerPosition.x, playerPosition.y, player, board.tile.length);
}

async function giveAP(user: User, target: User, guild: Guild): Promise<ActionResponse> {
    let player = await getById('player', guild, user.id) as Player;
    if (aliveCheck(player) == false) {
        return {
            success: false,
            error: 'invalid',
            message: 'You are dead',
            player: player,
            action: 'give-ap',
            data: null
        }
    }
    let targetPlayer = await getById('player', guild, target.id) as Player;

    let action: ActionResponse = {
        success: true,
        error: null,
        message: null,
        player: player,
        action: 'give-ap',
        data: {
            target: targetPlayer
        }
    }

    if (player.actionPoints < 1) {
        action.success = false;
        action.error = 'no energy';
        action.message = 'You do not have enough energy to give AP';
        return action;
    }

    if (targetPlayer.health == 0) {
        action.success = false;
        action.error = 'invalid';
        action.message = 'target is dead';
        return action;
    }

    let board = await getById('board', guild, '1') as Board;
    for (let i = 0; i < board.tile.length; i++) {
        for (let j = 0; j < board.tile[i].length; j++) {
            if (board.tile[i][j] == user.id) {
                var playerPosition = {x: i, y: j};
                break;
            }
        }
    }

    for (let i = 0; i < board.tile.length; i++) {
        for (let j = 0; j < board.tile[i].length; j++) {
            if (board.tile[i][j] == target.id) {
                var targetPosition = {x: i, y: j};
                break;
            }
        }
    }

    let inRange = tileIsInRange(targetPosition.x, targetPosition.y, playerPosition.x, playerPosition.y, player, board.tile.length);

    if (!inRange) {
        action.success = false;
        action.error = 'invalid';
        action.message = 'Target is out of range';
        return action;
    }

    targetPlayer.actionPoints++;
    player.actionPoints--;

    await set('player', guild, player);
    await set('player', guild, targetPlayer);

    return action;
}

async function death(player: Player, client: Client): Promise<void> {
    if (player.health != 0) {
        return;
    }

    let user = await client.users.fetch(player.id);

    // remove PLAYER role and add JURY role
    let guild = client.guilds.cache.first();
    let pRole = await guild.roles.fetch(process.env.PLAYER_ROLE_ID);
    let jRole = await guild.roles.fetch(process.env.JURY_ROLE_ID);
    await guild.members.fetch(user.id).then(member => {
        member.roles.remove(pRole);
        member.roles.add(jRole);
    });
    
    // await logAction(client, {
    //     success: true,
    //     error: null,
    //     message: null,
    //     player: player,
    //     action: 'death',
    //     data: null
    // });

    setTimeout(async () => {
        await addPlayerToJury(guild, player);
    })
}

async function getPlayerStatsEmbed(player: Player): Promise<Partial<Embed>> {
    let embed: Partial<Embed> = {
        title: player.displayName,
        fields: [
            {
                name: 'Action Points',
                value: `${player.actionPoints}`,
                inline: false
            },
            {
                name: 'Hearts',
                value: player.health.toString(),
                inline: false
            },
            {
                name: 'Range',
                value: player.range.toString(),
                inline: false
            }
        ]
    }

    return embed;
}

async function upgradeRange(user: User, guild: Guild): Promise<ActionResponse> {
    let player = await getById('player', guild, user.id) as Player;
    if (aliveCheck(player) == false) {
        return {
            success: false,
            error: 'invalid',
            message: 'You are dead',
            player: player,
            action: 'range-upgrade',
            data: null
        }
    }
    if (player.actionPoints < 3) {
        return {
            success: false,
            error: 'no energy',
            message: 'You do not have enough energy to upgrade range',
            player: player,
            action: 'range-upgrade',
            data: null
        }
    }
    player.range++;
    player.actionPoints -= 3;
    await set('player', guild, player);
    return {
        success: true,
        error: null,
        message: 'Range upgraded',
        player: player,
        action: 'range-upgrade',
        data: null
    }
}

async function addHeart(user: User, guild: Guild): Promise<ActionResponse> {
    let player = await getById('player', guild, user.id) as Player;
    if (aliveCheck(player) == false) {
        return {
            success: false,
            error: 'invalid',
            message: 'You are dead',
            player: player,
            action: 'heal',
            data: null
        }
    }
    if (player.actionPoints < 3) {
        return {
            success: false,
            error: 'no energy',
            message: 'You do not have enough energy to add a heart',
            player: player,
            action: 'heal',
            data: null
        }
    }
    player.health++;
    player.actionPoints -= 3;
    await set('player', guild, player);
    return {
        success: true,
        error: null,
        message: 'Heart added',
        player: player,
        action: 'heal',
        data: null
    }
}

function aliveCheck(player: Player): boolean {
    return player.health > 0;
}

export { createNewPlayer, move, attack, getPlayerStatsEmbed, upgradeRange, addHeart, giveAP, handleAPButton, death }
