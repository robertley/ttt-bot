import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { drawBoard, drawBoardCanvas } from "../../modules/board";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('print-board')
        .setDescription('Print board'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        // let board = await drawBoard(interaction.guild);
        // await interaction.reply(board);
        let board = await drawBoardCanvas(interaction.guild);
        await interaction.editReply({ files: [board] });
    },
}