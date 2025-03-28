import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { finalizeJuryVote } from "../../modules/jury";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finalize-jury-vote')
        .setDescription('finalize jury vote'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        await finalizeJuryVote(interaction.guild);
        await interaction.editReply('Jury vote finalized!');
    },
}