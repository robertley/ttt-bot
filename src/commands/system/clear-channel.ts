import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-channel')
        .setDescription('clear channel'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        await interaction.channel.bulkDelete(100);
        await interaction.editReply({content: 'Channel cleared!'});
    },
}