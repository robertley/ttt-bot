import { ButtonInteraction, ChatInputCommandInteraction, InteractionEditReplyOptions, MessageCreateOptions, TextChannel } from "discord.js";
import { AddTaskResult, BotTaskService, Task } from "./bot-task-service";
import { getAll, getById, set } from "./database";
import { Player } from "../interfaces/player.interface";
import { getDeleteMeButton } from "./functions";
import { addHeart, afterAttack, afterMove, afterSendAP, afterUpgradeRange, attack, getInRangePlayers, giveAP, giveAPFar, move, upgradeRange } from "./player";
import { Observable } from "rxjs";
import { ActionResponse } from "../interfaces/action-response.interace";
import { killPlayerEvents, logAction, updateAllSecretPlayerChannels, updateSecretPlayerChannel } from "./bot";

export interface BotInteraction<T> {
    interaction: ChatInputCommandInteraction;
    task: Task<T>;
    response: (taskResponse: T) => string;
    epehemeral?: boolean;
}

async function doBotInteraction(botInteraction: BotInteraction<any>): Promise<void> {
    let chatInteraction = botInteraction.interaction;
    await chatInteraction.deferReply({ ephemeral: botInteraction.epehemeral ?? false });

    if (!botInteraction.task) {
        await reply(botInteraction, botInteraction.response(null));
        return;
    }

    BotTaskService.addTask(botInteraction.task).subscribe({
        next: async (res) => {
            await reply(botInteraction, botInteraction.response(res));
        },
        error: async (err) => {
            await replyWithError(botInteraction, err);
        }
    });
}

async function reply(botInteraction: BotInteraction<any>, message: string): Promise<void> {
    let interaction = botInteraction.interaction;
    let player = await getById('player', interaction.guild, interaction.user.id) as Player;
    let buttons = [];
    if (player?.secretChannelId == interaction.channelId || player?.notifcationChannelId == interaction.channelId) {
        buttons.push(getDeleteMeButton());
    }
    let replyOptions: InteractionEditReplyOptions = {
        content: message,
        components: buttons.length > 0 ? [{ type: 1, components: buttons }] : []
    };
    interaction.editReply(replyOptions);
}

async function replyWithError(botInteraction: BotInteraction<any>, error: any): Promise<void> {
    let interaction = botInteraction.interaction;
    let player = await getById('player', interaction.guild, interaction.user.id) as Player;
    let buttons = [];
    if (player?.secretChannelId == interaction.channelId || player?.notifcationChannelId == interaction.channelId) {
        buttons.push(getDeleteMeButton());
    }
    let replyOptions: InteractionEditReplyOptions = {
        content: `Sorry ${interaction.user}, something went wrong while processing your request.`, // TODO better error message
        components: buttons.length > 0 ? [{ type: 1, components: buttons }] : [],
    };
    interaction.editReply(replyOptions);
}

async function sendMessageToChannel(channel: TextChannel, opts: {
    message: string,
    deleteMeButton?: boolean
}): Promise<void> {
    let buttons = [];
    if (opts.deleteMeButton) {
        buttons.push(getDeleteMeButton());
    }
    let sendOptions: MessageCreateOptions = {
        content: opts.message,
        components: buttons.length > 0 ? [{ type: 1, components: buttons }] : [],
    };
    channel.send(sendOptions);
}

async function handleAPButton(interaction: ButtonInteraction) {
    console.log(`Handling AP button: ${interaction.customId} for user ${interaction.user.tag}??`);
    await interaction.deferReply({ ephemeral: true });
    let action = interaction.customId.split('-')[1];
    let actionSecondary = interaction.customId.split('-')[2];
    // console.log(interaction.user);
    let message;
    let targetUser;

    let actionObservable;

    // open panel buttons
    switch (action) {
        case 'movePanel':
            actionObservable = openMovePanel(interaction);
            break;
        case 'attackPanel':
            actionObservable = openAttackPanel(interaction);
            break;
        case 'sendApPanel':
            actionObservable = openSendApPanel(interaction);
            break;
        case 'upgradeRangePanel':
            actionObservable = confirmPanel(interaction, 'upgradeRange');
            break;
        case 'healPanel':
            actionObservable = confirmPanel(interaction, 'heal');
            break;
    }

    if (actionObservable != null) {
        BotTaskService.addTask({
            fn: () => actionObservable,
            priority: 'low',
            name: `ap-button-${interaction.user.id}-${interaction.customId}`
        });

        return;
    }

    let afterFn;

    // else panel button
    switch (action) {
        case 'move':
            actionObservable = move(interaction.user, actionSecondary as 'up' | 'down' | 'left' | 'right', interaction.guild);
            afterFn = afterMove;
            break;
        case 'attack':
            targetUser = interaction.guild.members.cache.get(actionSecondary).user;
            actionObservable = attack(interaction.user, targetUser, interaction.guild);
            afterFn = afterAttack;
            break;
        case 'sendAp':
            targetUser = interaction.guild.members.cache.get(actionSecondary).user;
            actionObservable = giveAP(interaction.user, targetUser, interaction.guild);
            afterFn = afterSendAP;
            break;
        case 'sendApFar':
            targetUser = interaction.guild.members.cache.get(actionSecondary).user;
            actionObservable = giveAPFar(interaction.user, targetUser, interaction.guild);
            afterFn = afterSendAP;
            break;
        case 'upgradeRange':
            actionObservable = upgradeRange(interaction.user, interaction.guild);
            afterFn = afterUpgradeRange;
            break;
        case 'heal':
            actionObservable = addHeart(interaction.user, interaction.guild);
            afterFn = afterUpgradeRange;
            break;
    }

    if (actionObservable == null) {
        interaction.editReply({ content: 'Invalid action' });
        return;
    }

    BotTaskService.addTask({
        fn: () => actionObservable,
        priority: 'high',
        name: `ap-button-${interaction.user.id}-${interaction.customId}`,
        playerId: interaction.user.id,
        skipTimeout: action == 'sendAp',
        dataBaseFn: async (actionResponse: ActionResponse) => {
            if (actionResponse.success) {
                await afterFn(actionResponse, interaction.guild);
            }

            return null;
        }
    }).subscribe({
        next: async (result: AddTaskResult<ActionResponse>) => {

            const logActions = ['move', 'attack', 'upgradeRange', 'heal'];
            const noLogActions = ['give-ap', 'give-ap-far'];
            const cooldownActions = ['move', 'attack', 'upgradeRange', 'heal'];
            const noCooldownActions = ['give-ap', 'give-ap-far'];
            const updateAllChannelActions = ['move'];

            let actionResponse = result.resp as ActionResponse;

            if (result.error == 'timeout') {
                let inSeconds = +(result.timeRemaining / 1000).toFixed(2);
                interaction.editReply({ content: `Cannot perform another action for ${inSeconds} more seconds` });
                return;
            }

            let message = actionResponse.message ?? `AP left: ${actionResponse.player?.actionPoints ?? 'N/A'}`;

            if (cooldownActions.includes(actionResponse.action) && actionResponse.success) {
                let delay = 5000;
                let now = new Date();
                let diff = now.getTime() - result.date.getTime();
                let waitTime = Math.max(delay - diff, 0);
                let inSeconds = +(waitTime / 1000).toFixed(2);
                message += `\nCooldown timer: ${inSeconds > 0 ? inSeconds + ' seconds' : 'ready'}`;
            }

            interaction.editReply({ content: message })

            if (!actionResponse.success) {
                return;
            }

            if (logActions.includes(actionResponse.action)) {
                BotTaskService.addTask({
                    fn: () => logAction(interaction.client, actionResponse),
                    priority: 'high',
                    name: `log action ${interaction.user.id}-${interaction.customId}`,
                })
            }
            // 
            if (actionResponse.action == 'give-ap' || actionResponse.action == 'give-ap-far') {
                BotTaskService.addTask({
                    fn: () => new Observable<void>(sub => {
                        let user = interaction.user;
                        let target = actionResponse.data.target;
                        let channelId = target.notifcationChannelId;
                        let channel = interaction.guild.channels.cache.get(channelId) as TextChannel;
                        channel?.send({content: `<@${target.id}> You have been given 1 AP by <@${user.id}>`, components: [{type: 1, components: [getDeleteMeButton()]}]});
                        sub.next();
                    }),
                    priority: 'high',
                    name: `give ap after action ${interaction.user.id}-${interaction.customId}`,
                })
            }

            if (actionResponse.action == 'attack' && actionResponse.data?.target.health == 0) {
                BotTaskService.addTask({
                    fn: () => logAction(interaction.client, {
                        player: actionResponse.data.target,
                        action: 'death',
                        success: true,
                    }),
                    priority: 'high',
                    name: `log death action ${interaction.user.id}-${interaction.customId}`,
                });

                BotTaskService.addTask({
                    fn: () => killPlayerEvents(interaction.guild, actionResponse.player, actionResponse.data.target),
                    priority: 'high',
                    name: `kill player ${interaction.user.id}-${interaction.customId}`,
                    dataBaseFn: async () => {
                        await set('player', interaction.guild, actionResponse.player);
                        await set('player', interaction.guild, actionResponse.data.target);
                    }
                })
            }

            if (actionResponse.player) {
                BotTaskService.addTask({
                    fn: () => updateSecretPlayerChannel(interaction.guild, actionResponse.player),
                    priority: 'high',
                    name: `update secret channel ${interaction.user.id} ${interaction.customId}`,
                })
            }

            if (actionResponse.data?.target) {
                BotTaskService.addTask({
                    fn: () => updateSecretPlayerChannel(interaction.guild, actionResponse.data.target),
                    priority: 'high',
                    name: `update secret channel ${interaction.user.id}-${interaction.customId}`,
                }).subscribe(() => {

                });
            }

            if (updateAllChannelActions.includes(actionResponse.action)) {
                BotTaskService.addTask({
                    fn: () => updateAllSecretPlayerChannels(interaction.guild),
                    priority: 'low',
                    name: `update all secret channels`,
                    taskId: `update-all-secret-channels`
                })
            }
        },
        error: async (err) => {
            console.error(err);
            interaction.editReply({ content: `Sorry ${interaction.user}, something went wrong while processing your request.` });
        }
    });
}

function openMovePanel(interaction: ButtonInteraction) {
    return new Observable<void>(sub => {
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

        interaction.editReply({ content: 'Choose a direction', components: [{type: 1, components: [leftButton, rightButton, upButton, downButton]}]});
        sub.next();
        sub.complete();
    });
}

function openAttackPanel(interaction: ButtonInteraction) {
    return new Observable<void>(sub => {
        getById('player', interaction.guild, interaction.user.id).then(dbObj => {
            let player = dbObj as Player;
            getInRangePlayers(player, interaction.guild).then(resp => {
                let inRangePlayers = resp.inRange;
                let outOfRangePlayers = resp.outOfRange;

                if (inRangePlayers.length == 0) {
                    interaction.editReply({ content: 'No players in range' });
                    sub.next();
                    sub.complete();
                    return;
                } else {
        
                    let buttons = [];
                    for (let p of inRangePlayers) {
                        buttons.push({
                            label: `${p.displayName} ${p.emoji}`,
                            custom_id: `ap-attack-${p.id}`,
                            style: 1,
                            type: 2
                        });
                    }
            
                    let buttonGroups = [];
                    // split buttons into groups of 5 -- 4 if delete me button
                    while (buttons.length > 0) {
                        buttonGroups.push(buttons.splice(0, 5));
                    }
            
                    let message = `Select a player to attack:`;
                    if (buttonGroups.length == 0) {
                        interaction.editReply({ content: message, components: [{type: 1, components: buttonGroups[0]}] });
                    }
                    for (let i in buttonGroups) {
                        let group = buttonGroups[i];
                        if (+i == 0) {
                            interaction.editReply({ content: message, components: [{type: 1, components: group}] });
                            continue;
                        }
                        interaction.followUp({components: [{type: 1, components: group}], ephemeral: true })
                    }
                }

                sub.next();
                sub.complete();
            });
        })
    });
    
}


function openSendApPanel(interaction: ButtonInteraction) {
    return new Observable<void>(sub => {
        getById('player', interaction.guild, interaction.user.id).then(dbObj => {
            let player = dbObj as Player;
            getInRangePlayers(player, interaction.guild).then(async resp => {
                let inRangePlayers = resp.inRange;
                let outOfRangePlayers = resp.outOfRange;

                if (inRangePlayers.length == 0) {
                    await interaction.editReply({ content: 'No players in range' });
                } else {
        
                    let buttons = [];
                    for (let p of inRangePlayers) {
                        buttons.push({
                            label: `${p.displayName} ${p.emoji}`,
                            custom_id: `ap-sendAp-${p.id}`,
                            style: 1,
                            type: 2
                        });
                    }
            
                    let buttonGroups = [];
                    // split buttons into groups of 5 -- 4 if delete me button
                    while (buttons.length > 0) {
                        buttonGroups.push(buttons.splice(0, 5));
                    }
            
                    let message = `Select a player to send an AP'`;
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

                if (outOfRangePlayers.length < 0) {
                    interaction.followUp({ content: `No players out of range.`, ephemeral: true });
                } else {
                    let buttons = [];

                    for (let p of outOfRangePlayers) {
                        buttons.push({
                            label: `${p.displayName} ${p.emoji}`,
                            custom_id: `ap-sendApFar-${p.id}`,
                            style: 1,
                            type: 2
                        });
                    }

                    let buttonGroups = [];
                    // split buttons into groups of 5 -- 4 if delete me button
                    while (buttons.length > 0) {
                        buttonGroups.push(buttons.splice(0, 5));
                    }
                    for (let i in buttonGroups) {
                        let group = buttonGroups[i];
                        await interaction.followUp({  content: 'Out of range players: (2 AP -> 1 AP; Once per day)', components: [{type: 1, components: group}], ephemeral: true });
                    }

                }

                sub.next();
                sub.complete();
            })
        })
    });
    
}

function confirmPanel(interaction: ButtonInteraction, action: 'upgradeRange' | 'heal') {
    return new Observable<void>(sub => {
        let confirmButton = {
            type: 2,
            style: 1,
            label: 'Confirm',
            custom_id: `ap-${action}`,
        }

        interaction.editReply({ content: `Confirm ${action == 'upgradeRange' ? 'upgrade your range' : 'add a heart'}?`, components: [{type: 1, components: [confirmButton]}]});
        sub.next();
        sub.complete();
    });
}

export const BotInteractionService = {
    doBotInteraction,
    sendMessageToChannel,
    handleAPButton
}