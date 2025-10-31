import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Bot } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-setting')
        .setDescription('Set a game setting')
        .addStringOption(option => option.setName('key').setDescription('Setting key to set').setRequired(true).setChoices([
            { name: 'apScheduleCron', value: 'apScheduleCron' },
            { name: 'juryOpenScheduleCron', value: 'juryOpenScheduleCron' },
            { name: 'juryMin3Votes', value: 'juryMin3Votes' },
            { name: 'juryMin4Votes', value: 'juryMin4Votes' },
            { name: 'juryMin5Votes', value: 'juryMin5Votes' },
        ]))
        .addStringOption(option => option.setName('value').setDescription('Value to set').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        await Bot.updateSetting(interaction.guild, interaction.options.get('key').value as string, interaction.options.get('value').value as string);
        await interaction.editReply('Setting updated');
    },
}