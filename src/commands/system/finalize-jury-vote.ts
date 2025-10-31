import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Jury } from "../../modules/jury";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finalize-jury-vote')
        .setDescription('finalize jury vote'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        await Jury.finalizeJuryVote(interaction.guild);
        await interaction.editReply('Jury vote finalized!');
    },
}