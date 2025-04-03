import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById, initNewServer } from "../../modules/database";
import { drawBoardCanvas, drawPlayerBoard } from "../../modules/board";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";


module.exports = {
    data: new SlashCommandBuilder()
        .setName('i-see-player-board')
        .setDescription('see the board for a player')
        .addUserOption(option => option.setName('player').setDescription('The player to see the board for').setRequired(true)),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();

        let commandUser = await getById('player', interaction.guild, interaction.user.id) as Player;
        let buttons = [];
        if (commandUser.secretChannelId == interaction.channelId) {
            buttons.push(getDeleteMeButton());
        }

        // await interaction.deferReply({ ephemeral: true });
        let user = interaction.options.get('player').user;
        let player = await getById('player', interaction.guild, user.id) as Player;
        if (player == null) {
            await interaction.editReply({ content: 'Player not found', components: buttons.length > 0 ? [{type: 1, components: buttons}] : null });
            return;
        }
        let board = await drawBoardCanvas(interaction.guild, {
            player: player
        });



        await interaction.editReply({ files: [board], components: buttons.length > 0 ? [{type: 1, components: buttons}] : null });
    },
}