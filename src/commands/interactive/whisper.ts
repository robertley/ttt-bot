import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { getById, pushToWhispersLog } from "../../modules/database";
import { Player } from "../../interfaces/player.interface";
import { getDeleteMeButton } from "../../modules/functions";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whisper')
        .setDescription('whisper something anonymously to another player')
        .addUserOption(option => option.setName('player').setDescription('player you are whispering to').setRequired(true))
        .addStringOption(option => option.setName('message').setDescription('message you are whispering').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        let player = await getById<Player>('player', interaction.guild, interaction.user.id) as Player;
        let target = interaction.options.get('player').user;

        let buttons = [];
        // if (player.secretChannelId == interaction.channelId) {
        //     buttons.push(getDeleteMeButton());
        // }

        let targetPlayer = await getById<Player>('player', interaction.guild, target.id) as Player;
        let targetPlayerChannel = interaction.guild.channels.cache.get(targetPlayer.notifcationChannelId) as TextChannel;
        if (!targetPlayerChannel) {
            await interaction.editReply({
                content: `Could not find a channel for ${target.displayName}`,
                components: buttons.length > 0 ? [{type: 1, components: buttons}] : null
            });
            return;
        }

        let message = interaction.options.get('message').value as string;

        await targetPlayerChannel.send({
            content: `${target} - Someone whispered to you: "*${message}*"`, components: []//{type: 1, components: [getDeleteMeButton()]}]
        });

        await interaction.editReply({
            content: `You whispered to ${target.displayName}: "*${message}*"`,
            components: buttons.length > 0 ? [{type: 1, components: buttons}] : null
        });

        pushToWhispersLog(interaction.guild, message);
    },
}