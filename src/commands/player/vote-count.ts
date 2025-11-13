import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from "discord.js";
import { Jury } from "../../modules/jury";
import { BotInteraction, BotInteractionService } from "../../modules/bot-interaction.service";
import { Observable } from "rxjs";


// TODO refund votes if player dies
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ju-vote-count')
        .setDescription('see how many Jury votes have been submitted'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {

        let botInteraction: BotInteraction<{votes: number, votesRequired: number, success: boolean}> = {
            interaction: interaction,
            task: {
                fn: () => {
                    return new Observable<{votes: number, votesRequired: number, success: boolean}>((sub) => {
                        let hasRole = false;
                        (interaction.member as GuildMember).roles.cache.forEach(role => {
                            if (role.id == process.env.JURY_ROLE_ID) {
                                hasRole = true;
                                return;
                            }
                        });

                        if (!hasRole) {
                            sub.next({ votes: 0, votesRequired: 0, success: true });
                            sub.complete();
                            return;
                        }

                        Jury.getVoteCount(interaction.guild).subscribe((resp) => {
                            sub.next({ votes: resp.votes, votesRequired: resp.votesRequired, success: true });
                            sub.complete();
                        });
                    })
                },
                name: 'Jury Vote',
                priority: 'low'
            },
            response: (resp) => {
                if (!resp.success) {
                    return "You must be a jury to use this command.";
                }
                return `${resp.votes} votes have been submitted. ${resp.votesRequired} votes are required to award AP.`;
            }
        };

        await BotInteractionService.doBotInteraction(botInteraction);
    }
}