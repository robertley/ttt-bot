import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { initNewServer } from "../../modules/database";
import { updateBoardChannel } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refresh-board-channel')
        .setDescription('Refresh the board channel'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        await updateBoardChannel(interaction.guild);
        await interaction.editReply('Board Channel Refreshed');
    },
}