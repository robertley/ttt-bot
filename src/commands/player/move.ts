import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { move } from "../../modules/player";
import { doActionEvents } from "../../modules/bot";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ap-move')
        .setDescription('Move your player. Costs 1 AP')
        .addStringOption(option => option.setName('direction').setDescription('The direction to move in').setRequired(true).setChoices([
            {
                name: 'up',
                value: 'up'
            },
            {
                name: 'down',
                value: 'down'
            },
            {
                name: 'left',
                value: 'left'
            },
            {
                name: 'right',
                value: 'right'
            }
        ])),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        let direction = interaction.options.get('direction').value;
        if (direction != 'up' && direction != 'down' && direction != 'left' && direction != 'right') {
            await interaction.editReply({ content: 'Invalid direction. Please use up, down, left, or right.' });
            return;
        }
        let resp = await move(interaction.user, direction, interaction.guild);
        if (!resp.success) {
            await interaction.editReply({ content: `Could not move: ${resp.error} - ${resp.message}` });
            return;
        }

        let files = [];
        // let board = await drawBoardCanvas(interaction.guild);
        // files.push(board);
        let message = `Moved ${direction}! AP remaining: ${resp.player.actionPoints}`;
        await interaction.editReply({ content: message, files: files });
        
        await doActionEvents({
            guild: interaction.guild, 
            user: interaction.user, 
            actionResponse: resp
        });
    },
}