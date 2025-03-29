import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById, set } from "../../modules/database";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('brain-or-brawn')
        .setDescription('ask weff if you are on a brain or brawn tribe'),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        let player = await getById('player', interaction.guild, interaction.user.id) as Player;

        let buttons = [];
        if (player.secretChannelId == interaction.channelId) {
            buttons.push(getDeleteMeButton());
        }

        let responses = [];

        if (player.brainOrBrawn == null) {
            // wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 2000));
            let brainOrBrawn = Math.random() < 0.5 ? 'brain' : 'brawn';
            player.brainOrBrawn = brainOrBrawn as 'brain' | 'brawn';
            await set('player', interaction.guild, player);
            responses = [
                `After careful consideration, you are on the ${brainOrBrawn} tribe!`,
                `I have decided that you are on the ${brainOrBrawn} tribe!`,
                `You are definitely on the ${brainOrBrawn} tribe!`,
                `You are a ${brainOrBrawn}!`
            ];
        } else {
            responses = [
                `You are already on the ${player.brainOrBrawn} tribe!`,
                `You are already a ${player.brainOrBrawn}!`,
                `You are already a member of the ${player.brainOrBrawn} tribe!`,
                `I told you this, you are a ${player.brainOrBrawn}!`
            ];
            
        }

        await interaction.editReply({
            content: `${interaction.user} ${responses[Math.floor(Math.random() * responses.length)]}`,
            components: buttons.length > 0 ? [{type: 1, components: buttons}] : null
        });
    },
}