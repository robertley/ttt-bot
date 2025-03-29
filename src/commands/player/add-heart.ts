import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { addHeart, upgradeRange } from "../../modules/player";
import { doActionEvents } from "../../modules/bot";


module.exports = {
    data: new SlashCommandBuilder()
        .setName('ap-add-heart')
        .setDescription('Increase your hearts by 1. Costs 3 AP'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        let resp = await addHeart(interaction.user, interaction.guild);
        if (!resp.success) {
            let message = `Could not add heart: ${resp.error} - ${resp.message}`;
            await interaction.editReply({ content: message });
            return;
        }
        await doActionEvents({
            guild: interaction.guild,
            user: interaction.user,
            actionResponse: resp
        })

        let message = `Heart added! AP remaining: ${resp.player.actionPoints}`;
        await interaction.editReply({ content: message });
    },
}