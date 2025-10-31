import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Bot } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('confirm-start-game')
        .setDescription('Confirm start a new game'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        Bot.updateBoardChannel(interaction.guild).subscribe(() => {});
        Bot.updateAllSecretPlayerChannels(interaction.guild).subscribe(() => {});
        
        Bot.logAction(interaction.client, {
            success: true,
            action: 'new-game',
        }).subscribe(() => {});

        await interaction.editReply({ content: 'Game started!' });
    },
}