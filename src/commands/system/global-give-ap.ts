import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { initNewServer } from "../../modules/database";
import { givePlayersActionPoints } from "../../modules/game";
import { updateAllSecretPlayerChannels } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('global-give-ap')
        .setDescription('give players AP')
        .addNumberOption(option => option.setName('amount').setDescription('amount of AP to give').setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        let amount = interaction.options.get('amount')?.value as number;
        if (isNaN(amount) || amount == null) {
            amount = 1;
        }
        await givePlayersActionPoints(interaction.guild, amount);
        await interaction.editReply('AP given');
        updateAllSecretPlayerChannels(interaction.guild).subscribe(() => {});
    },
}