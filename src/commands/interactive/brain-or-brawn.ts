import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById, set } from "../../modules/database";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";
import { BotInteraction, BotInteractionService } from "../../modules/bot-interaction.service";
import { Observable } from "rxjs";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('brain-or-brawn')
        .setDescription('ask weff if you are on a brain or brawn tribe'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {

        let player: Player;

        let botInteraction: BotInteraction<string> = {
            interaction: interaction,
            task: {
                fn: () => new Observable(sub => {
                    getById<Player>('player', interaction.guild, interaction.user.id).then(dbObj => {
                        console.log('calling brain-or-brawn interaction task');
                        player = dbObj as Player;
                        let buttons = [];
                        if (player.secretChannelId == interaction.channelId || player.notifcationChannelId == interaction.channelId) {
                            buttons.push(getDeleteMeButton());
                        }

                        let responses = [];
            
                        if (player.brainOrBrawn == null) {
                            // wait 5 seconds
                            setTimeout(() => {
                                let brainOrBrawn = Math.random() < 0.5 ? 'brain' : 'brawn';
                                player.brainOrBrawn = brainOrBrawn as 'brain' | 'brawn';
                                responses = [
                                    `After careful consideration, you are on the ${brainOrBrawn} tribe!`,
                                    `I have decided that you are on the ${brainOrBrawn} tribe!`,
                                    `You are definitely on the ${brainOrBrawn} tribe!`,
                                    `You are a ${brainOrBrawn}!`
                                ];

                                let resp = responses[Math.floor(Math.random() * responses.length)];
                                sub.next(resp);
                            }, 5000);

                            return;
                        } else {
                            responses = [
                                `You are already on the ${player.brainOrBrawn} tribe!`,
                                `You are already a ${player.brainOrBrawn}!`,
                                `You are already a member of the ${player.brainOrBrawn} tribe!`,
                                `I told you this, you are a ${player.brainOrBrawn}!`
                            ];
                        }

                        let resp = responses[Math.floor(Math.random() * responses.length)];

                        sub.next(resp);
                    });
                }),
                priority: 'low',
                name: `brain-or-brawn-${interaction.user.id}`,
                dataBaseFn: async () => {
                    await set('player', interaction.guild, player);
                }
            },
            response: (resp: string) => {
                return `${interaction.user} ${resp}`;
            }
        }

        await BotInteractionService.doBotInteraction(botInteraction);

        // await interaction.editReply({
        //     content: `${interaction.user} ${responses[Math.floor(Math.random() * responses.length)]}`,
        //     components: buttons.length > 0 ? [{type: 1, components: buttons}] : null
        // });
    },
}