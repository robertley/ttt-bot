import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { initNewServer } from "../../modules/database";
import { givePlayersActionPoints } from "../../modules/game";
import { updateAllSecretPlayerChannels } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('global-give-ap')
        .setDescription('give players AP'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        await givePlayersActionPoints(interaction.guild);
        await interaction.editReply('AP given');
        setTimeout(async () => {
            await updateAllSecretPlayerChannels(interaction.guild);
        });
    },
}