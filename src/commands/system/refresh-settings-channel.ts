import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Bot } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refresh-settings-channel')
        .setDescription('Refresh the settings channel'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        await Bot.updateSettingsChannel(interaction.guild);
        await interaction.editReply('Settings Refreshed');
    },
}