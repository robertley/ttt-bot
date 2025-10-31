import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById } from "../../modules/database";
import { Bot } from "../../modules/bot";
import { Player } from "../../interfaces/player.interface";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-actions-channel')
        .setDescription('Reset your actions channel'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        interaction.deferReply({ ephemeral: true });
        let player = await getById<Player>('player', interaction.guild, interaction.user.id);
        if (!player) {
            await interaction.editReply({ content: 'You are not a player in this server.' });
            return;
        }

        Bot.resetSecretPlayerChannel(player, interaction.guild).subscribe({
            next: async () => {
                await interaction.editReply({ content: 'Your secret channel has been reset.' });
                // reply might be deleted so do nothing?
            },
            error: async (err) => {
                await interaction.editReply({ content: 'There was an error resetting your secret channel.' });
                console.error('Error resetting secret channel:', err);
            }
        });
    },
}