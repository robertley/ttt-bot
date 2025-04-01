import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { initNewServer } from "../../modules/database";
import { newGame } from "../../modules/game";
import { updateAllSecretPlayerChannels, updateBoardChannel } from "../../modules/bot";
import { drawBoardCanvas } from "../../modules/board";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start-game')
        .setDescription('Start a new game'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        console.log('starting game...')
        try {
            await newGame(interaction.guild);
        } catch (error) {
            console.error('Error starting game:', error);
            await interaction.editReply({ content: 'Error starting game' });
            return;
        }

        
        let board = await drawBoardCanvas(interaction.guild);
        await interaction.editReply({ content: 'Confirm board', files: [board] });
    },
}