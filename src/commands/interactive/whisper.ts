import { CommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { getById } from "../../modules/database";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whisper')
        .setDescription('whisper something anonymously to another player')
        .addUserOption(option => option.setName('player').setDescription('player you are whispering to').setRequired(true))
        .addStringOption(option => option.setName('message').setDescription('message you are whispering').setRequired(true)),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        let player = await getById('player', interaction.guild, interaction.user.id) as Player;
        let target = interaction.options.get('player').user;

        let buttons = [];
        // if (player.secretChannelId == interaction.channelId) {
        //     buttons.push(getDeleteMeButton());
        // }

        let targetPlayer = await getById('player', interaction.guild, target.id) as Player;
        let targetPlayerChannel = interaction.guild.channels.cache.get(targetPlayer.secretChannelId) as TextChannel;
        if (!targetPlayerChannel) {
            await interaction.editReply({
                content: `Could not find a channel for ${target.displayName}`,
                components: buttons.length > 0 ? [{type: 1, components: buttons}] : null
            });
            return;
        }

        await targetPlayerChannel.send({
            content: `${target} - Someone whispered to you: "*${interaction.options.get('message').value}*"`, components: [{type: 1, components: [getDeleteMeButton()]}]
        });

        await interaction.editReply({
            content: `You whispered to ${target.displayName}: "*${interaction.options.get('message').value}*"`,
            components: buttons.length > 0 ? [{type: 1, components: buttons}] : null
        });
    },
}