import { Guild } from 'discord.js';
import { Board } from '../interfaces/board.interface';
import { getAll, getById } from './database';
import { Player } from '../interfaces/player.interface';
import { Canvas, createCanvas, Image } from 'canvas';
import { ActionResponse, AttackData, MoveData } from '../interfaces/action-response.interace';

const getUnicode = require('emoji-unicode')

function makeEmptyBoard(): Board {
    let boardSize = +process.env.BOARD_SIZE || 10;
    let board: Board = {
        id: '1',
        tile: []
    };
    for (let i = 0; i < boardSize; i++) {
        board.tile.push([]);
        for (let j = 0; j < boardSize; j++) {
            board.tile[i].push(null);
        }
    }
    return board;
}

async function drawBoard(guild: Guild): Promise<string> {
    let board: Board = await getById('board', guild, '1') as Board;
    let players = await getAll('player', guild) as Map<string, Player>;
    let boardString = '';
    // let testemo = guild.client.emojis.cache.find(e => e.name == 'testemo');
    // let square = guild.client.emojis.cache.find(e => e.name == 'black_medium_square');
    // console.log(square);

    let tiles = board.tile;
    for (let i = 0; i < tiles.length; i++) {
        for (let j = 0; j < tiles[i].length; j++) {
            let tileValue = tiles[j][i];
            if (tileValue == null) {
                boardString += `◼`;
            } else {
                let player = players.get(tileValue);
                if (player.health == 0) {
                    boardString += '💀';
                    continue;
                }
                let emoji = players.get(tileValue).emoji;
                boardString += emoji;
            }
        }
        boardString += '\n';
    }

    return boardString;
}

async function drawPlayerBoard(guild: Guild, player: Player): Promise<string> {
    let board: Board = await getById('board', guild, '1') as Board;
    let players = await getAll('player', guild) as Map<string, Player>;
    let boardString = '';
    let tiles = board.tile;
    
    // find player position
    let playerX = 0;
    let playerY = 0;
    for (let i = 0; i < tiles.length; i++) {
        for (let j = 0; j < tiles[i].length; j++) {
            if (tiles[j][i] == player.id) {
                playerX = i;
                playerY = j;
                break;
            }
        }
    }

    for (let i = 0; i < tiles.length; i++) {
        for (let j = 0; j < tiles[i].length; j++) {
            let tileValue = tiles[j][i];
            if (tileValue == null) {
                if (tileIsInRange(i, j, playerX, playerY, player, board.tile.length)) {
                    boardString += '▫';
                } else {
                    boardString += '◼';
                }
            } else {
                let player = players.get(tileValue);
                if (player.health == 0) {
                    boardString += '💀';
                    continue;
                }
                let emoji = players.get(tileValue).emoji;
                boardString += emoji;
            }
        }
        boardString += '\n';
    }

    return boardString;
}

function tileIsInRange(x: number, y: number, playerX: number, playerY: number, player: Player, length: number): boolean {
    let range = player.range;

    // Torodial Distance
    let dx = Math.abs(x - playerX);
    let dy = Math.abs(y - playerY);
    if (dx > length / 2) {
        dx = length - dx;
    }
    if (dy > length / 2) {
        dy = length - dy;
    }
    let distance = Math.max(dx, dy);
    if (distance <= range) {
        return true;
    }
    return false;
}

async function drawBoardCanvas(guild: Guild, opts?: {
    actionResponse?: ActionResponse,
    player?: Player
}): Promise<Buffer> {
    
    let player = opts?.player;
    let actionResponse = opts?.actionResponse;

    let board: Board = await getById('board', guild, '1') as Board;
    let players = await getAll('player', guild) as Map<string, Player>;
    let imageSize = 500;
    let canvas = createCanvas(imageSize, imageSize);
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(0, 0, imageSize, imageSize);
    let tileSize = imageSize / board.tile.length;
    let padding = 2;
    let tiles = board.tile;

    let playerX = 0;
    let playerY = 0;

    if (player) {
        // find player position
        for (let i = 0; i < tiles.length; i++) {
            for (let j = 0; j < tiles[i].length; j++) {
                if (tiles[j][i] == player.id) {
                    playerX = i;
                    playerY = j;
                    break;
                }
            }
        }
    }


    // Draw empty tiles first
    for (let i = 0; i < tiles.length; i++) {
        for (let j = 0; j < tiles[i].length; j++) {
            // const tileValue = tiles[i][j];

            let fillColor = '#2d3338';
            if (player && tileIsInRange(j, i, playerX, playerY, player, board.tile.length)) {
                fillColor = '#6b3c37';
            }
            ctx.fillStyle = fillColor;
            ctx.fillRect(i * tileSize + padding, j * tileSize + padding, tileSize - padding * 2, tileSize - padding * 2);
        }
    }
    
    // Then load and draw player emojis
    const loadImagePromises = [];

    let move = actionResponse?.action == 'move' ? actionResponse.data : null;
    let direction = move ? (actionResponse.data as MoveData).direction : null;
    let attackPlayer = actionResponse?.action == 'attack' ? actionResponse.player : null;
    let targetPlayer = actionResponse?.action == 'attack' ? (actionResponse.data as AttackData).target : null;
    let oldX = null;
    let oldY = null;

    if (move) {
        // find players old position
        for (let i = 0; i < tiles.length; i++) {
            for (let j = 0; j < tiles[i].length; j++) {
                if (tiles[j][i] == actionResponse.player.id) {
                    oldY = i;
                    oldX = j;
                    break;
                }
            }
        }
        let dx = 0;
        let dy = 0;
        switch (direction) {
            case 'up':
                dy = 1;
                break;
            case 'down':
                dy = -1;
                break;
            case 'left':
                dx = 1;
                break;
            case 'right':
                dx = -1;
                break;
        }
        oldX += dx;
        oldY += dy;
    }
        
    for (let i = 0; i < tiles.length; i++) {
        for (let j = 0; j < tiles[i].length; j++) {
            const tileValue = tiles[i][j];
            if (tileValue != null) {
                const player = players.get(tileValue);
                let emoji = player.emoji;
                if (player.health == 0) {
                    emoji = '💀';
                }
                const emojiUnicode = getUnicode(emoji).replace(/\s/g, '-');
                const emojiImage = `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${emojiUnicode}.png`;
                
                // Create promise for loading this image
                const loadPromise = new Promise((resolve, reject) => {
                    const emoji = new Image();
                    emoji.onload = () => {
                        ctx.drawImage(emoji, i * tileSize + padding, j * tileSize + padding, 
                                     tileSize - padding * 2, tileSize - padding * 2);
                        resolve(null);
                    };
                    emoji.onerror = () => {
                        // On error, draw a fallback
                        ctx.fillStyle = 'red';
                        ctx.fillRect(i * tileSize + padding, j * tileSize + padding, 
                                    tileSize - padding * 2, tileSize - padding * 2);
                        console.error(`Failed to load emoji image: ${emojiImage}`);
                        resolve(null);
                    };
                    emoji.src = emojiImage;
                });
                
                loadImagePromises.push(loadPromise);

                // Draw attack emoji
                if (targetPlayer && player.id == targetPlayer.id) {
                    const loadPromise = new Promise((resolve, reject) => {
                        const emoji = new Image();
                        emoji.src = 'https://twitter.github.io/twemoji/v/13.1.0/72x72/1f4a5.png';
                        emoji.onload = () => {
                            ctx.drawImage(emoji, i * tileSize + padding + (tileSize / 2), j * tileSize + padding + (tileSize / 2), 
                                tileSize * .8 - padding * 2, tileSize * .8 - padding * 2);
                            resolve(null);
                        };
                    });
                    loadImagePromises.push(loadPromise);
                }

                // Draw attack emoji
                if (attackPlayer && player.id == attackPlayer.id) {
                    const loadPromise = new Promise((resolve, reject) => {
                        const emoji = new Image();
                        let emojiUnicode = getUnicode('⚔').replace(/\s/g, '-');
                        emoji.src = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${emojiUnicode}.png`;
                        emoji.onload = () => {
                            ctx.drawImage(emoji, i * tileSize + padding + (tileSize / 2), j * tileSize + padding + (tileSize / 2), 
                                tileSize * .8 - padding * 2, tileSize * .8 - padding * 2);
                            resolve(null);
                        };
                    });
                    loadImagePromises.push(loadPromise);
                }
            }

            // Draw move emoji
            if (move && oldY == j && oldX == i) {
                const loadPromise = new Promise((resolve, reject) => {
                    const emoji = new Image();
                    let directionEmojiUnicode = '';
                    switch (direction) {
                        case 'up':
                            directionEmojiUnicode = getUnicode('🔼').replace(/\s/g, '-');
                            emoji.src = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${directionEmojiUnicode}.png`;
                            break;
                        case 'down':
                            directionEmojiUnicode = getUnicode('🔽').replace(/\s/g, '-');
                            emoji.src = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${directionEmojiUnicode}.png`;
                            break;
                        case 'left':
                            directionEmojiUnicode = getUnicode('◀').replace(/\s/g, '-');
                            emoji.src = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${directionEmojiUnicode}.png`;
                            break;
                        case 'right':
                            directionEmojiUnicode = getUnicode('▶').replace(/\s/g, '-');
                            emoji.src = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${directionEmojiUnicode}.png`;
                            break;
                    }
                    emoji.onload = () => {
                        ctx.drawImage(emoji, i * tileSize + padding, j * tileSize + padding, 
                            tileSize - padding * 2, tileSize - padding * 2);
                        resolve(null);
                    };

                    
                });
                loadImagePromises.push(loadPromise);
            }
        }
    }
    
    // Wait for all images to load
    await Promise.all(loadImagePromises);

    return canvas.toBuffer();
}

export { makeEmptyBoard, drawBoard, drawPlayerBoard, tileIsInRange, drawBoardCanvas };