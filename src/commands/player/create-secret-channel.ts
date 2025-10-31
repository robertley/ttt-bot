import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Bot } from "../../modules/bot";


module.exports = {
    data: new SlashCommandBuilder()
        .setName('sc-create-secret-channel')
        .setDescription('create a secret channel to conive in')
        .addStringOption(option => option.setName('name').setDescription('The name of the channel').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        await Bot.createSecretGroupChannel(interaction.guild, interaction.user, interaction.options.get('name').value as string);
        await interaction.editReply({ content: 'Channel created' });
    }
}