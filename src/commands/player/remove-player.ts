import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { removeUserFromSecretChannel } from "../../modules/bot";


module.exports = {
    data: new SlashCommandBuilder()
        .setName('sc-remove-player')
        .setDescription('remove a player from a secret channel')
        .addUserOption(option => option.setName('player').setDescription('removee').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        try {
            let resp = await removeUserFromSecretChannel(interaction, interaction.options.get('player').user);
        } catch (e) {
            await interaction.editReply({ content: "This is not a secret group channel" });
            return;
        }
        await interaction.editReply({ content: 'Player removed' });
    }
}