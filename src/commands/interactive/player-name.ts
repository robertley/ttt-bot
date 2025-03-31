import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById, initNewServer } from "../../modules/database";
import { drawBoardCanvas, drawPlayerBoard } from "../../modules/board";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";
import { get } from "http";
import { PlayerNameRecord } from "../../interfaces/player-name-record.inteface";


module.exports = {
    data: new SlashCommandBuilder()
        .setName('i-player-name')
        .setDescription('have weff dox the player to you')
        .addUserOption(option => option.setName('player').setDescription('The player whose kname you want to know').setRequired(true)),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ephemeral: true});

        getById('player-name-record', interaction.guild, interaction.options.get('player').user.id).then(async (nameRecord: PlayerNameRecord) => {
            if (nameRecord) {
                await interaction.editReply({ content: `The player's name is ${nameRecord.name}` });
            } else {
                await interaction.editReply({ content: `Player not found` });
            }
        });
    }
}