import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { initNewServer } from "../../modules/database";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('init')
        .setDescription('test command'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        console.log('init server...')
        await initNewServer(interaction.guild);
        await interaction.editReply('Server initialized!');
    },
}