import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { getDeleteMeButton } from "../../modules/functions";
import { BotInteraction, BotInteractionService } from "../../modules/bot-interaction.service";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help-bert')
        .setDescription('ONLY USE IF YOU ARE SURE THERE IS AN ERROR WITH THE BOT')
        .addStringOption(option => option.setName('message').setDescription('OPTIONAL: Any details you are willing to share').setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        // TODO verify that this works - problems with delete me button
        let BotInteraction: BotInteraction<void> = {
            interaction: interaction,
            epehemeral: true,
            task: null,
            response: () => {
                let message = interaction.options.get('message')?.value;
                let channel = interaction.client.channels.cache.get(process.env.HELP_CHANNEL_ID) as TextChannel;
                if (!channel) {
                    return 'Could not find help channel.';
                }
                BotInteractionService.sendMessageToChannel(channel, {
                    message: `Help request from ${interaction.user.tag} (${interaction.user.id}): ${message ?? 'No additional details provided.'}`,
                    deleteMeButton: true
                }).then(() => {
                    return 'Help request sent to Bert, if identity was provided you will be contacted. Otherwise look for a generic message in #general when resolved.';
                });

            }
        };

        await BotInteractionService.doBotInteraction(BotInteraction);
    },
}