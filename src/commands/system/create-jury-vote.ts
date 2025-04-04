import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { createJuryVote } from "../../modules/jury";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-jury-vote')
        .setDescription('create jury vote'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        await createJuryVote(interaction.guild);
        await interaction.editReply('Jury vote created!');
    },
}