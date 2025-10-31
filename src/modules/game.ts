import { Guild, TextChannel } from "discord.js";
import { Game } from "../interfaces/game.interface";
import { getAll, set } from "./database";
import { BoardModule } from "./board";
import { Board } from "../interfaces/board.interface";
import { Player } from "../interfaces/player.interface";
import { Bot } from "./bot";

export async function newGame(guild: Guild): Promise<void> {
    let players = await getAll('player', guild);
    let playerIds = Array.from(players.keys());

    // get all players with Jury role and remove the role
    let juryRole = guild.roles.cache.find(role => role.id === process.env.JURY_ROLE_ID);
    let users = guild.members.cache.filter(member => member.roles.cache.has(juryRole.id));
    for (let user of users.values()) {
        await user.roles.remove(juryRole);
    }

    let board: Board = BoardModule.makeEmptyBoard();

    let game: Game = {
        id: '1',
        boardId: board.id,
        playerIds: playerIds,
        dateStarted: new Date(),
        dateEnded: null,
        winnerId: null
    }

    // TODO make this smarter ?
    let playerPositions;
    let allowedAttempts = 10000;
    let attempts = 0;

    console.log('Creating player positions...', playerIds);

    let positionsFound = false;
    while (!positionsFound && attempts < allowedAttempts) {
        attempts++;
        // console.log('Trying to find unique player positions...');
        playerPositions = createPlayerPositions(playerIds);

        // check if playerPositions are unique
        let uniquePositions = new Set(playerPositions.map(p => JSON.stringify(p)));
        if (uniquePositions.size !== playerPositions.length) {
            // console.log('..');
            continue;
        }

        // check if any player is less than 3 tiles away from another player
        let boardSize = +process.env.BOARD_SIZE || 10;
        let positionInvalid = false;
        for (let i = 0; i < playerPositions.length; i++) {
            let minDistance = Infinity;
            for (let j = i + 1; j < playerPositions.length; j++) {
                let pos1 = playerPositions[i];
                let pos2 = playerPositions[j];
                let xDistance = Math.abs(pos1.x - pos2.x);
                let yDistance = Math.abs(pos1.y - pos2.y);
                let wrappingDistanceX = boardSize - xDistance;
                let wrappingDistanceY = boardSize - yDistance;
                let distance = Math.min(xDistance, wrappingDistanceX) + Math.min(yDistance, wrappingDistanceY);
                if (distance < 3) {
                    positionInvalid = true;
                    // console.log(`Players at positions ${pos1.x},${pos1.y} and ${pos2.x},${pos2.y} are too close (${distance} tiles apart), retrying...`);
                    console.log('.')
                    break;
                }

                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
            if (positionInvalid) {
                break;
            }
            if (minDistance > 5) {
                console.log(`Player at position ${playerPositions[i].x},${playerPositions[i].y} is too far from others (min distance ${minDistance} tiles), retrying...`);
                positionsFound = true;
                // positionInvalid = true;
                break;
            }
        }
        if (positionInvalid) {
            continue;
        }

        positionsFound = true;
    }

    if (attempts === allowedAttempts) {
        console.error(`Could not find unique player positions after ${allowedAttempts} attempts`);
        throw new Error('Could not find unique player positions after 10 attempts');
    }

    console.log('Player positions created', playerPositions);

    for (let i in playerPositions) {
        let position = playerPositions[i];
        let playerId = playerIds[i];
        board.tile[position.x][position.y] = playerId;
        console.log(`Player ${playerId} placed at ${position.x}, ${position.y}`);
    }


    await set('game', guild, game);
    await set('board', guild, board);

    // let logChannel = guild.client.channels.cache.get(process.env.LOG_CHANNEL_ID) as TextChannel;
    // delete all messages in log channel
    // let messages = await logChannel.messages.fetch();
    // for (let message of messages.values()) {
    //     await message.delete();
    // }
}

function createPlayerPositions(playerIds: string[]): { x: number, y: number }[] {
    let boardSize = +process.env.BOARD_SIZE || 10;
    console.log('Board size:', boardSize, playerIds.length);
    let playerPositions = [];
    // for (let i = 0; i < playerIds.length; i++) {
    //     let x = Math.floor(Math.random() * boardSize);
    //     let y = Math.floor(Math.random() * boardSize);
    //     playerPositions.push({x: x, y: y});
    // }

    let allowedAttempts = 1000;
    let attempts = 0;

    while (playerPositions.length < playerIds.length && attempts < allowedAttempts) {
        console.log('Placing player', playerPositions.length + 1);
        attempts++;
        let x = Math.floor(Math.random() * boardSize);
        let y = Math.floor(Math.random() * boardSize);
        let existingPos = playerPositions.find(pos => pos.x === x && pos.y === y);
        if (existingPos != null) {
            console.log(`Position ${x},${y} already taken, retrying...`);
            continue;
        }

        let positionInvalid = false;
        // check if there is a player less than 2 tiles away
        for (let pos of playerPositions) {
            let xDistance = Math.abs(pos.x - x);
            let yDistance = Math.abs(pos.y - y);
            let wrappingDistanceX = boardSize - xDistance;
            let wrappingDistanceY = boardSize - yDistance;
            let distance = Math.min(xDistance, wrappingDistanceX) + Math.min(yDistance, wrappingDistanceY);
            if (distance < 4) {
                console.log(`Position ${x},${y} is too close to another player, retrying...`);
                positionInvalid = true;
                break;
            }
        }

        if (!positionInvalid) {
            playerPositions.push({ x: x, y: y });
        }
    }

    if (attempts === allowedAttempts) {
        console.error(`Could not place all players after ${allowedAttempts} attempts`);
        throw new Error('Could not place all players on the board');
    }

    return playerPositions;
}

export async function givePlayersActionPoints(guild: Guild, amt = 1): Promise<void> {
    let players = await getAll<Player>('player', guild);
    for (let player of players.values()) {
        if (player.health > 0) {
            player.actionPoints += amt;
            player.sentLongRangeAp = false;
        }
    }
    await set('player', guild, Array.from(players.values()));

    Bot.logAction(guild.client, {
        success: true,
        action: 'scheduled-ap',
    }).subscribe(() => {});
}