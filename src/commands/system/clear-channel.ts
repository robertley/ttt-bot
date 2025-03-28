import { CommandInteraction, SlashCommandBuilder } from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-channel')
        .setDescription('clear channel'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        await interaction.channel.bulkDelete(100);
        await interaction.editReply({content: 'Channel cleared!'});
    },
}