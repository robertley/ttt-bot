import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { initNewServer } from "../../modules/database";
import { newGame } from "../../modules/game";
import { logAction, updateAllSecretPlayerChannels, updateBoardChannel } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('confirm-start-game')
        .setDescription('Confirm start a new game'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        updateBoardChannel(interaction.guild).subscribe(() => {});
        updateAllSecretPlayerChannels(interaction.guild).subscribe(() => {});
        
        logAction(interaction.client, {
            success: true,
            action: 'new-game',
        }).subscribe(() => {});

        await interaction.editReply({ content: 'Game started!' });
    },
}