import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById } from "../../modules/database";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";
import { BotInteraction, BotInteractionService } from "../../modules/bot-interaction.service";
import { Observable } from "rxjs";
import { get } from "http";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hi-weff')
        .setDescription('say hi to weff!'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {

        let botInteraction: BotInteraction<string> = {
            interaction: interaction,
            epehemeral: false,
            task: {
                fn: () => new Observable<string>(sub => {
                    let playerUser = interaction.user;
                    
                    let weffResponses = [
                        `Hey ${playerUser}!`,
                        `Come on in, ${playerUser}!`,
                        `Wanna know what your playing for? ${playerUser}`,
                        `Worth playing for? ${playerUser}`,
                        `You got to dig deep! ${playerUser}`,
                        `${playerUser} got nothing for ya, grab your stuff head back to camp.`,
                        `THAT'S how you do it on TANK TACTICS! ${playerUser}`,
                        `If anybody has a hidden ${playerUser} idol and you want to play it, now would be the time to do so.`,
                        `Once the votes are read the decision is final, ${playerUser} will be voted out and be asked to leave the tribal council area immediately, I'll read the votes. `
                    ];

                    sub.next(weffResponses[Math.floor(Math.random() * weffResponses.length)]);
                }),
                priority: 'low',
                name: 'hi-weff-command'
            },
            response: (resp) => resp
        }
        
        await BotInteractionService.doBotInteraction(botInteraction);
    },
}