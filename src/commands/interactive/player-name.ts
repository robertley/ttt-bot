import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById, initNewServer } from "../../modules/database";
import { drawBoardCanvas, drawPlayerBoard } from "../../modules/board";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";
import { get } from "http";
import { PlayerNameRecord } from "../../interfaces/player-name-record.inteface";
import { BotInteraction, BotInteractionService } from "../../modules/bot-interaction.service";
import { Observable } from "rxjs";


module.exports = {
    data: new SlashCommandBuilder()
        .setName('i-player-name')
        .setDescription('have weff dox the player to you')
        .addUserOption(option => option.setName('player').setDescription('The player whose kname you want to know').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {

        let botInteraction: BotInteraction<string> = {
            interaction: interaction,
            epehemeral: true,
            task: {
                fn: () => new Observable<string>(sub => {
                    getById('player-name-record', interaction.guild, interaction.options.get('player').user.id).then((nameRecord: PlayerNameRecord) => {
                        if (nameRecord) {
                            sub.next(`The player's name is ${nameRecord.name}`);
                        } else {
                            sub.next(`Player not found`);
                        }
                        sub.complete();
                    });
                }),
                priority: 'low',
                name: 'i-player-name-command'
            },
            response: (resp) => resp
        };

        await BotInteractionService.doBotInteraction(botInteraction);
    }
}