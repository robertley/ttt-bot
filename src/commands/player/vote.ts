import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from "discord.js";
import { Jury } from "../../modules/jury";
import { getById } from "../../modules/database";
import { Settings } from "../../interfaces/settings.interface";
import { BotInteraction, BotInteractionService } from "../../modules/bot-interaction.service";
import { Observable } from "rxjs";


// TODO refund votes if player dies
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ju-vote')
        .setDescription('vote for a player to get an extra AP')
        .addUserOption(option => option.setName('player').setDescription('candidate').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {

        let botInteraction: BotInteraction<{ success: boolean, message?: string }> = {
            interaction: interaction,
            ephemeral: true,
            task: {
                fn: () => { 
                    return new Observable<{ success: boolean, message?: string }>((sub) => {
                        let candidate = interaction.guild?.members.cache.get(interaction.options.get('player')?.user.id || '');
                        let hasRole = false;
                        (interaction.member as GuildMember).roles.cache.forEach(role => {
                            if (role.id == process.env.JURY_ROLE_ID) {
                                hasRole = true;
                            }
                        });

                        if (!hasRole) {
                            sub.error("You must be a jury to vote");
                            sub.complete();
                            return;
                        }
                        
                        getById<Settings>('settings', interaction.guild).then((settings) => {

                            if (settings.juryOpen == false) {
                                sub.next({
                                    success: false,
                                    message: "Jury voting is currently closed"
                                });
                                sub.complete();
                                return;
                            }

                            hasRole = false;

                            candidate?.roles.cache.forEach(role => {
                                if (role.id == process.env.PLAYER_ROLE_ID) {
                                    hasRole = true;
                                    return;
                                }
                            });

                            if (!hasRole) {
                                sub.next({
                                    success: false,
                                    message: "You can only vote for alive players"
                                });
                                sub.complete();
                                return;
                            }

                            Jury.juryVote(interaction.guild, interaction.user, candidate.user).then(() => {
                                sub.next({ success: true, message: 'Vote cast' });
                                sub.complete();
                            });
                        });
                    });
                },
                name: 'Jury Vote',
                priority: 'low'
            },
            response: (resp) => {
                console.log('Jury Vote response:', resp);
                return resp.message;
            }
        };
        await BotInteractionService.doBotInteraction(botInteraction);
    }
}