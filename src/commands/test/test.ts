import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

module.exports = {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('test command'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        console.log('running test...')
        await interaction.reply('Pong!');
    },
}