import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById, initNewServer } from "../../modules/database";
import { BoardModule } from "../../modules/board";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";
import { BotInteractionService } from "../../modules/bot-interaction.service";


module.exports = {
    data: new SlashCommandBuilder()
        .setName('i-see-player-board')
        .setDescription('see the board for a player')
        .addUserOption(option => option.setName('player').setDescription('The player to see the board for').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        BotInteractionService.seePlayerBoard(interaction);
    },
};