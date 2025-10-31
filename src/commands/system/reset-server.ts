import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getConfirmButton } from "../../modules/functions";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-server')
        .setDescription('Reset the server'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.reply({ components: [{ type: 1, components: [getConfirmButton('reset-server')] }], content: 'Are you sure?', ephemeral: true });
    },
}