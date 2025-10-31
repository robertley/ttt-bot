import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from "discord.js";
import { Jury } from "../../modules/jury";


// TODO refund votes if player dies
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ju-remove-vote')
        .setDescription('remove your Jury vote'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        let hasRole = false;
        (interaction.member as GuildMember).roles.cache.forEach(role => {
            if (role.id == process.env.JURY_ROLE_ID) {
                hasRole = true;
                return;
            }
        });

        if (!hasRole) {
            await interaction.editReply({ content: "You must be a jury to vote" });
        }

        await Jury.removeVote(interaction.guild, interaction.user);
        await interaction.editReply({ content: 'Vote has been removed' });
    }
}