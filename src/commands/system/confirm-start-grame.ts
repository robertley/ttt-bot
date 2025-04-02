import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { initNewServer } from "../../modules/database";
import { newGame } from "../../modules/game";
import { logAction, updateAllSecretPlayerChannels, updateBoardChannel } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('confirm-start-game')
        .setDescription('Confirm start a new game'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        await updateBoardChannel(interaction.guild);
        setTimeout(async () => {
            await updateAllSecretPlayerChannels(interaction.guild);
        })
        
        await logAction(interaction.client, {
            success: true,
            action: 'new-game',
        });

        await interaction.editReply({ content: 'Game started!' });
    },
}