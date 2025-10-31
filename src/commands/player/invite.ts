import { ChatInputCommandInteraction, SlashCommandBuilder, User } from "discord.js";
import { Bot } from "../../modules/bot";


module.exports = {
    data: new SlashCommandBuilder()
        .setName('sc-add-player')
        .setDescription('add a player into a secret channel')
        .addUserOption(option => option.setName('player').setDescription('invitee').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        let invitee = interaction.guild?.members.cache.get(interaction.options.get('player')?.user.id || '');
        
        let hasRole = false;
        invitee?.roles.cache.forEach(role => {
            if (role.id == process.env.PLAYER_ROLE_ID || role.id == process.env.JURY_ROLE_ID) {
                hasRole = true;
                return;
            }
        });

        if (!hasRole) {
            await interaction.editReply({ content: "Invalid user" });
            return;
        }

        try {
            let resp = await Bot.addUserToSecretChannel(interaction, interaction.options.get('player').user);
        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: "This is not a secret group channel" });
            return;
        }
        await interaction.editReply({ content: 'Player added' });
    }
}