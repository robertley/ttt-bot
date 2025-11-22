import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Bot } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('release-the-whispers')
        .setDescription('rsend whispers to the whisper channel')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        Bot.releaseTheWhispers(interaction.guild).subscribe(() => {});
        await interaction.editReply('Whispers released');
    },
}