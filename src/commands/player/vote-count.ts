import { CommandInteraction, GuildMember, SlashCommandBuilder, User } from "discord.js";
import { getVoteCount } from "../../modules/jury";


// TODO refund votes if player dies
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ju-vote-count')
        .setDescription('see how many Jury votes have been submitted'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        let hasRole = false;
        (interaction.member as GuildMember).roles.cache.forEach(role => {
            if (role.id == process.env.JURY_ROLE_ID) {
                hasRole = true;
                return;
            }
        });

        if (!hasRole) {
            await interaction.editReply({ content: "You must be a jury member to see vote count" });
            return;
        }

        let count = await getVoteCount(interaction.guild);

        await interaction.editReply({ content: `${count} votes have been submitted` });
    }
}