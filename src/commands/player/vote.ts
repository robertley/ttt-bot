import { CommandInteraction, GuildMember, SlashCommandBuilder, User } from "discord.js";
import { juryVote } from "../../modules/jury";
import { getById } from "../../modules/database";
import { Settings } from "../../interfaces/settings.interface";


// TODO refund votes if player dies
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ju-vote')
        .setDescription('vote for a player to get an extra AP')
        .addUserOption(option => option.setName('player').setDescription('candidate').setRequired(true)),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        let candidate = interaction.guild?.members.cache.get(interaction.options.get('player')?.user.id || '');

        let hasRole = false;
        (interaction.member as GuildMember).roles.cache.forEach(role => {
            if (role.id == process.env.JURY_ROLE_ID) {
                hasRole = true;
                return;
            }
        });

        if (!hasRole) {
            await interaction.editReply({ content: "You must be a jury to vote" });
            return;
        }
        
        let settings = await getById('settings', interaction.guild) as Settings;
        if (settings.juryOpen == false) {
            await interaction.editReply({ content: "Jury is not open" });
            return;
        }

        hasRole = false;

        candidate?.roles.cache.forEach(role => {
            if (role.id == process.env.PLAYER_ROLE_ID) {
                hasRole = true;
                return;
            }
        });

        if (!hasRole) {
            await interaction.editReply({ content: "Invalid user, must be an alive player" });
            return;
        }

        await juryVote(interaction.guild, interaction.user, candidate.user);
        await interaction.editReply({ content: 'Vote casted' });
    }
}