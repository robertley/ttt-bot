import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { initNewServer } from "../../modules/database";
import { Bot } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refresh-board-channel')
        .setDescription('Refresh the board channel'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        await Bot.updateBoardChannel(interaction.guild).toPromise();
        // await Bot.updateAllSecretPlayerChannels(interaction.guild);
        await interaction.editReply('Board Channel Refreshed');
    },
}