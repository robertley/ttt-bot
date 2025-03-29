import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { attack } from "../../modules/player";
import { doActionEvents } from "../../modules/bot";
import { AttackData } from "../../interfaces/action-response.interace";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ap-attack')
        .setDescription('Attack another player. Costs 1 AP')
        .addUserOption(option => option.setName('target').setDescription('player you are attacking').setRequired(true)),
    async execute(interaction: CommandInteraction): Promise<void> {
        interaction.deferReply({ ephemeral: true });
        let target = interaction.options.get('target').user;
        let resp = await attack(interaction.user, target, interaction.guild);
        if (!resp.success) {
            let message = `Could not attack: ${resp.error} - ${resp.message}`;
            await interaction.editReply({ content: message });
            return;
        }
        
        let message = `Attacked ${target.displayName}! AP remaining: ${resp.player.actionPoints}`;
        await interaction.editReply({ content: message });
        await doActionEvents({
            guild: interaction.guild,
            user: interaction.user,
            actionResponse: resp,
            target: target,
        });
        
        let targetPlayer = (resp.data as AttackData).target;
        if (targetPlayer.health == 0) {
            await doActionEvents({
                guild: interaction.guild,
                user: target,
                actionResponse: {
                    success: true,
                    error: null,
                    message: `You have been defeated by ${interaction.user.displayName}`,
                    player: targetPlayer,
                    action: 'death',
                    data: null,
                }
            })
        }
    },
}