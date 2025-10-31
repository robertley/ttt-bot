// import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
// import { upgradeRange } from "../../modules/player";

// module.exports = {
//     data: new SlashCommandBuilder()
//         .setName('ap-upgrade-range')
//         .setDescription('Increase your range by 1. Costs 3 AP'),
//     async execute(interaction: ChatInputCommandInteraction): Promise<void> {
//         await interaction.deferReply({ ephemeral: true });
//         // let resp = await upgradeRange(interaction.user, interaction.guild);
//         // if (!resp.success) {
//         //     let message = `Could not upgrade range: ${resp.error} - ${resp.message}`;
//         //     await interaction.editReply({ content: message });
//         //     return;
//         // }
//         // await doActionEvents({
//         //     guild: interaction.guild,
//         //     user: interaction.user,
//         //     actionResponse: resp
//         // })

//         // let message = `Range upgraded! AP remaining: ${resp.player.actionPoints}`;
//         // await interaction.editReply({ content: message });
//     },
// }