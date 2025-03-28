import { Guild, TextChannel } from "discord.js";
import { Game } from "../interfaces/game.interface";
import { getAll, set } from "./database";
import { makeEmptyBoard } from "./board";
import { Board } from "../interfaces/board.interface";
import { Player } from "../interfaces/player.interface";
import { logAction } from "./bot";

export async function newGame(guild: Guild): Promise<void> {
    let players = await getAll('player', guild);
    let playerIds = Array.from(players.keys());

    // get all players with Jury role and remove the role
    let juryRole = guild.roles.cache.find(role => role.id === process.env.JURY_ROLE_ID);
    let users = guild.members.cache.filter(member => member.roles.cache.has(juryRole.id));
    for (let user of users.values()) {
        user.roles.remove(juryRole);
    }

    let board: Board = makeEmptyBoard();

    let game: Game = {
        id: '1',
        boardId: board.id,
        playerIds: playerIds,
        dateStarted: new Date(),
        dateEnded: null,
        winnerId: null
    }

    // TODO make this smart
    // give all players a random position on the board
    let playerPositions = [];
    for (let i = 0; i < playerIds.length; i++) {
        let x = Math.floor(Math.random() * 10);
        let y = Math.floor(Math.random() * 10);
        playerPositions.push({x: x, y: y});
    }

    for (let i in playerPositions) {
        let position = playerPositions[i];
        let playerId = playerIds[i];
        board.tile[position.x][position.y] = playerId;
        // console.log(`Player ${playerId} placed at ${position.x}, ${position.y}`);
    }


    await set('game', guild, game);
    await set('board', guild, board);

    // let logChannel = guild.client.channels.cache.get(process.env.LOG_CHANNEL_ID) as TextChannel;
    // delete all messages in log channel
    // let messages = await logChannel.messages.fetch();
    // for (let message of messages.values()) {
    //     await message.delete();
    // }

    logAction(guild.client, {
        success: true,
        action: 'new-game',
    });
}

export async function givePlayersActionPoints(guild: Guild): Promise<void> {
    let players = await getAll('player', guild) as Map<string, Player>;
    for (let player of players.values()) {
        if (player.health > 0)
            player.actionPoints++;
    }
    await set('player', guild, Array.from(players.values()));

    await logAction(guild.client, {
        success: true,
        action: 'scheduled-ap',
    })
}