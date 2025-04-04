import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { updateSettingsChannel } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refresh-settings-channel')
        .setDescription('Refresh the settings channel'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        await updateSettingsChannel(interaction.guild);
        await interaction.editReply('Settings Refreshed');
    },
}