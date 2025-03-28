import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { initNewServer } from "../../modules/database";
import { newGame } from "../../modules/game";
import { updateAllSecretPlayerChannels, updateBoardChannel } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start-game')
        .setDescription('Start a new game'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        console.log('starting game...')
        await newGame(interaction.guild);
        await updateBoardChannel(interaction.guild);
        setTimeout(async () => {
            await updateAllSecretPlayerChannels(interaction.guild);
        })
        // await logAction(interaction.client, interaction.guild, resp);
        await interaction.editReply('Game started!');
    },
}