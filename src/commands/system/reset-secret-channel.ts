import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById } from "../../modules/database";
import { updateSecretPlayerChannel } from "../../modules/bot";
import { Player } from "../../interfaces/player.interface";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-secret-channel')
        .setDescription('Reset someones secret channel')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to reset the secret channel for')
                .setRequired(true)),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        let user = interaction.options.get('user').user;
        let player = await getById('player', interaction.guild, user.id) as Player;
        await updateSecretPlayerChannel(interaction.guild, player);
        await interaction.editReply('Board Channel Refreshed');
    },
}