import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { getById } from "../../modules/database";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hi-weff')
        .setDescription('say hi to weff!'),
    async execute(interaction: CommandInteraction): Promise<void> {
        let playerUser = `${interaction.user}`;
        let buttons = [];
        
        try {
            let player = await getById('player', interaction.guild, interaction.user.id) as Player;
            if (player.secretChannelId == interaction.channelId) {
                buttons.push(getDeleteMeButton());
            }
        } catch (err) {
            // if player doesnt exist that is ok
            console.error(err);
        }


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
        ]

        await interaction.reply({ content: weffResponses[Math.floor(Math.random() * weffResponses.length)], components: buttons.length > 0 ? [{type: 1, components: buttons}] : null });
    },
}