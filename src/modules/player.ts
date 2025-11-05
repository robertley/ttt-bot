import { ButtonInteraction, Client, Embed, Guild, TextChannel, User } from "discord.js";
import { Player } from "../interfaces/player.interface";
import { set, getById, getAll } from "./database";
import { ActionResponse, AttackData } from "../interfaces/action-response.interace";
import { Board } from "../interfaces/board.interface";
import { Bot } from "./bot";
import { BoardModule } from "./board";
import { Jury } from "./jury";
import { Observable } from "rxjs";

const DEV = process.env.DEV === 'true';

async function createNewPlayer(user: User, guild: Guild, emoji, fake: boolean = false): Promise<Player> {

    if (!fake) {
        let existingPlayer = await getById<Player>('player', guild, user.id) as Player;
        if (existingPlayer != null) {
            existingPlayer.emoji = emoji;
            await set('player', guild, existingPlayer);
            return existingPlayer;
        }
    }

    let allPlayers = await getAll('player', guild) as Map<string, Player>;
    let fakePlayers = Array.from(allPlayers.values()).filter(p => p.fake);
    let fakeName = `FakePlayer${fakePlayers.length + 1}`;

    let player: Player = {
        id: fake ? `fake-${fakePlayers.length + 1}` : user.id,
        displayName: fake ? fakeName : user.displayName,
        actionPoints: DEV ? 100 : 0,
        health: 3,
        range: DEV ? 5 : 2,
        emoji: emoji,
        secretChannelId: null,
        notifcationChannelId: null,
        diedDate: null,
        kills: [],
        brainOrBrawn: null,
        sentLongRangeAp: false,
        fake: fake
    }

    player.secretChannelId = await Bot.createSecretPlayerChannel(guild, player);
    player.notifcationChannelId = await Bot.createNotifcationPlayerChannel(guild, player);

    if (fake) {
        await set('player', guild, player);
        return player;
    }

    // give user PLAYER role
    let role = await guild.roles.fetch(process.env.PLAYER_ROLE_ID);
    await guild.members.fetch(user.id).then(async member => {
        await member.roles.add(role);
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


    await set('player', guild, player);

    return player;
}

async function getInRangePlayers(player: Player, guild: Guild): Promise<{ inRange: Player[], outOfRange: Player[] }> {
    let board = await getById<Board>('board', guild, '1') as Board;
    let playerMap = await getAll<Player>('player', guild) as Map<string, Player>;
    let otherPlayers = Array.from(playerMap.values()).filter(p => p.id != player.id && p.health > 0);
    let inRangePlayers = [];
    let outOfRangePlayers = [];
    for (let oPlayer of otherPlayers) {
        if (await playerIsInRange(board, player, oPlayer)) {
            inRangePlayers.push(oPlayer);
        } else {
            outOfRangePlayers.push(oPlayer);
        }
    }

    return { inRange: inRangePlayers, outOfRange: outOfRangePlayers };
}

function move(user: User, direction: 'up' | 'down' | 'left' | 'right', guild: Guild): Observable<ActionResponse> {
    return new Observable<ActionResponse>(sub => {
        getById<Player>('player', guild, user.id).then((player: Player) => {
            getById<Board>('board', guild, '1').then((board: Board) => {
                if (aliveCheck(player) == false) {
                    sub.next({
                        success: false,
                        error: 'invalid',
                        message: 'You are dead',
                        player: player,
                        board: board,
                        action: 'move',
                        data: null
                    });
                    return;
                }
            
                let action: ActionResponse = {
                    success: true,
                    error: null,
                    message: null,
                    player: player,
                    board: board,
                    action: 'move',
                    data: {
                        direction: direction
                    }
                }
                
                if (player.actionPoints < 1) {
                    action.success = false;
                    action.error = 'no AP';
                    action.message = 'You do not have enough AP to move';
                    sub.next(action);
                    return;
                }
            
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
                    sub.next(action);
                    return;
                }
            
                player.actionPoints--;
            
                board.tile[playerPosition.x][playerPosition.y] = null;
                board.tile[newPosition.x][newPosition.y] = player.id;
            
                action.success = true;
                sub.next(action);
                sub.complete();
            }).catch((error) => {
                sub.error(error);
                sub.complete();
            });
        }).catch((error) => {
            sub.error(error);
            sub.complete();
        });
    });
}

async function afterMove(ActionResponse: ActionResponse, guild: Guild) {
    let player = ActionResponse.player;
    let board = ActionResponse.board;
    await set('player', guild, player);
    await set('board', guild, board);
    console.log('afterMove: player and board saved');
}

function attack(user: User, target: User, guild: Guild): Observable<ActionResponse> {
    return new Observable<ActionResponse>(sub => {
        getById<Player>('player', guild, user.id).then((player: Player) => {
            if (aliveCheck(player) == false) {
                sub.next({
                    success: false,
                    error: 'invalid',
                    message: 'You are dead',
                    player: player,
                    action: 'attack',
                    data: null
                });
                return;
            }

            getById<Player>('player', guild, target.id).then((targetPlayer: Player) => {
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
                    action.error = 'no AP';
                    action.message = 'You do not have enough AP to attack';
                    sub.next(action);
                    return;
                }
            
                if (targetPlayer.health == 0) {
                    action.success = false;
                    action.error = 'invalid';
                    action.message = 'target is dead';
                    sub.next(action);
                    return;
                }
            
                getById<Board>('board', guild, '1').then((board: Board) => {
                    let inRange = playerIsInRange(board, player, targetPlayer);
            
                    if (!inRange) {
                        action.success = false;
                        action.error = 'invalid';
                        action.message = 'Target is out of range';
                        sub.next(action);
                        return;
                    }
                
                    targetPlayer.health--;
                    player.actionPoints--;

                    sub.next(action);
                }).catch((error) => {
                    sub.error(error)
                    sub.complete()
                });
            
            }).catch((error) => {
                sub.error(error)
                sub.complete()
            });
        }).catch((error) => {
            sub.error(error)
            sub.complete()
        });
    });
}

async function afterAttack(actionResponse: ActionResponse, guild: Guild) {
    await set('player', guild, actionResponse.player);
    await set('player', guild, actionResponse.data.target);
}

function playerIsInRange(board: Board, player: Player, target: Player): boolean {
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

    return BoardModule.tileIsInRange(targetPosition.x, targetPosition.y, playerPosition.x, playerPosition.y, player, board.tile.length);
}

function giveAP(user: User, target: User, guild: Guild): Observable<ActionResponse> {

    return new Observable<ActionResponse>(sub => {
        getById<Player>('player', guild, user.id).then((player: Player) => {

            if (aliveCheck(player) == false) {
                sub.next({
                    success: false,
                    error: 'invalid',
                    message: 'You are dead',
                    player: player,
                    action: 'give-ap',
                    data: null
                });
                return;
            }

            getById<Player>('player', guild, target.id).then((targetPlayer: Player) => {

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
                    action.error = 'no AP';
                    action.message = 'You do not have enough AP to send AP';
                    sub.next(action);
                    return;
                }
            
                if (targetPlayer.health == 0) {
                    action.success = false;
                    action.error = 'invalid';
                    action.message = 'target is dead';
                    sub.next(action);
                    return;
                }
            
                getById<Board>('board', guild, '1').then((board: Board) => {

                    action.board = board;

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
                
                    let inRange = BoardModule.tileIsInRange(targetPosition.x, targetPosition.y, playerPosition.x, playerPosition.y, player, board.tile.length);
                
                    if (!inRange) {
                        action.success = false;
                        action.error = 'invalid';
                        action.message = 'Target is out of range';
                        sub.next(action);
                        return;
                    }
                
                    targetPlayer.actionPoints++;
                    player.actionPoints--;
                
                    sub.next(action);
                }).catch((error) => {
                    sub.error(error)
                    sub.complete()
                });
            }).catch((error) => {
                sub.error(error)
                sub.complete()
            });
        }).catch((error) => {
            sub.error(error)
            sub.complete()
        });
    });
}


function giveAPFar(user: User, target: User, guild: Guild): Observable<ActionResponse> {

    return new Observable<ActionResponse>(sub => {
        getById<Player>('player', guild, user.id).then((player: Player) => {

            if (aliveCheck(player) == false) {
                sub.next({
                    success: false,
                    error: 'invalid',
                    message: 'You are dead',
                    player: player,
                    action: 'give-ap',
                    data: null
                });
                return;
            }

            getById<Player>('player', guild, target.id).then((targetPlayer: Player) => {

                if (player.sentLongRangeAp) {
                    sub.next({
                        success: false,
                        error: 'invalid',
                        message: 'You have already sent long range AP this round',
                        player: player,
                        action: 'give-ap-far',
                        data: null
                    });
                    return;
                }

                // maybe change
                const cost = 2;

                let action: ActionResponse = {
                    success: true,
                    error: null,
                    message: null,
                    player: player,
                    action: 'give-ap-far',
                    data: {
                        target: targetPlayer
                    }
                }
            
                if (player.actionPoints < cost) {
                    action.success = false;
                    action.error = 'no AP';
                    action.message = 'You do not have enough AP to send AP out of range';
                    sub.next(action);
                    return;
                }
            
                if (targetPlayer.health == 0) {
                    action.success = false;
                    action.error = 'invalid';
                    action.message = 'target is dead';
                    sub.next(action);
                    return;
                }
            
                getById<Board>('board', guild, '1').then((board: Board) => {

                    action.board = board;

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
                
                    let outOfRange = !BoardModule.tileIsInRange(targetPosition.x, targetPosition.y, playerPosition.x, playerPosition.y, player, board.tile.length);
                
                    if (!outOfRange) {
                        action.success = false;
                        action.error = 'invalid';
                        action.message = 'Target is not out of range';
                        sub.next(action);
                        return;
                    }
                
                    targetPlayer.actionPoints++;
                    player.actionPoints -= cost;
                    player.sentLongRangeAp = true;
                
                    sub.next(action);
                }).catch((error) => {
                    sub.error(error)
                    sub.complete()
                });
            }).catch((error) => {
                sub.error(error)
                sub.complete()
            });
        }).catch((error) => {
            sub.error(error)
            sub.complete()
        });
    });
}

async function afterSendAP(actionResponse: ActionResponse, guild: Guild) {
    await set('player', guild, actionResponse.player);
    await set('player', guild, actionResponse.data.target);
}

function death(player: Player, client: Client): Observable<void> {
    return new Observable<void>(sub => {
        if (player.health != 0) {
            return;
        }
    
        client.users.fetch(player.id).then(user => {
            // remove PLAYER role and add JURY role
            let guild = client.guilds.cache.first();
            guild.roles.fetch(process.env.PLAYER_ROLE_ID).then(pRole => {
                guild.roles.fetch(process.env.JURY_ROLE_ID).then(jRole => {

                    guild.members.fetch(user.id).then(async member => {
                        await member.roles.remove(pRole);
                        await member.roles.add(jRole);
                    }).then(() => {
                        Jury.addPlayerToJury(guild, player).subscribe(() => {
                            sub.next(null);
                            sub.complete();
                        });
                    }).catch((error) => {
                        sub.error(error)
                        sub.complete()
                    });
                }).catch((error) => {
                    sub.error(error)
                    sub.complete()
                });
            }).catch((error) => {
                sub.error(error)
                sub.complete()
            });
        }).catch((error) => {
            sub.error(error)
            sub.complete()
        });
    });
}

function getPlayerStatsEmbed(player: Player): Partial<Embed> {
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

function upgradeRange(user: User, guild: Guild): Observable<ActionResponse> {
    return new Observable<ActionResponse>(sub => {
        getById<Player>('player', guild, user.id).then((player: Player) => {
            if (aliveCheck(player) == false) {
                sub.next({
                    success: false,
                    error: 'invalid',
                    message: 'You are dead',
                    player: player,
                    action: 'range-upgrade',
                    data: null
                });
                return;
            }
            if (player.actionPoints < 3) {
                sub.next({
                    success: false,
                    error: 'no AP',
                    message: 'You do not have enough AP to upgrade range',
                    player: player,
                    action: 'range-upgrade',
                    data: null
                });
                return;
            }
            player.range++;
            player.actionPoints -= 3;
            sub.next({
                success: true,
                error: null,
                message: 'Range upgraded',
                player: player,
                action: 'range-upgrade',
                data: null
            });
        }).catch((error) => {
            sub.error(error)
            sub.complete()
        });
    });
}

async function afterUpgradeRange(actionResponse: ActionResponse, guild: Guild) {
    let player = actionResponse.player;
    await set('player', guild, player);
}

function addHeart(user: User, guild: Guild): Observable<ActionResponse> {

    return new Observable<ActionResponse>(sub => {
        getById<Player>('player', guild, user.id).then((player: Player) => {
            if (aliveCheck(player) == false) {
                sub.next({
                    success: false,
                    error: 'invalid',
                    message: 'You are dead',
                    player: player,
                    action: 'heal',
                    data: null
                });
                return;
            }
            if (player.actionPoints < 2) {
                sub.next({
                    success: false,
                    error: 'no AP',
                    message: 'You do not have enough AP to add a heart',
                    player: player,
                    action: 'heal',
                    data: null
                });
                return;
            }
            player.health++;
            player.actionPoints -= 2;
            // await set('player', guild, player);
            sub.next({
                success: true,
                error: null,
                message: 'Heart added',
                player: player,
                action: 'heal',
                data: null
            });
        }).catch((error) => {
            sub.error(error)
            sub.complete()
        });
    });
}

function aliveCheck(player: Player): boolean {
    return player.health > 0;
}

export {
    createNewPlayer,
    move,
    attack,
    getPlayerStatsEmbed,
    upgradeRange,
    addHeart,
    giveAP,
    giveAPFar,
    death,
    getInRangePlayers,
    afterMove,
    afterAttack,
    afterSendAP,
    afterUpgradeRange
}
