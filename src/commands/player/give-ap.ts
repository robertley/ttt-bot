import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { giveAP } from "../../modules/player";
import { doActionEvents} from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ap-give-ap')
        .setDescription('Give another player AP. Costs 1 AP')
        .addUserOption(option => option.setName('target').setDescription('player you are giving AP to').setRequired(true)),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        let target = interaction.options.get('target').user;
        let resp = await giveAP(interaction.user, target, interaction.guild);
        if (!resp.success) {
            let message = `Could not give AP: ${resp.error} - ${resp.message}`;
            await interaction.editReply({ content: message });
            return;
        }
        
        let message = `Gave ${target.displayName} 1 AP! AP remaining: ${resp.player.actionPoints}`;
        await interaction.editReply({ content: message });
        await doActionEvents({
            guild: interaction.guild,
            user: interaction.user,
            actionResponse: resp,
            target: target,
        });
    
    },
}