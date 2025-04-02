import { CommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-log')
        .setDescription('clear log channel'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        let channel = interaction.client.channels.cache.get(process.env.LOG_CHANNEL_ID) as TextChannel;
        let messages = await channel.messages.fetch();
        await channel.bulkDelete(messages);

        await interaction.editReply('Log cleared');
    },
}