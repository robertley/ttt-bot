import { CommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { getDeleteMeButton } from "../../modules/functions";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help-bert')
        .setDescription('ONLY USE IF YOU ARE SURE THERE IS AN ERROR WITH THE BOT')
        .addStringOption(option => option.setName('message').setDescription('OPTIONAL: Any details you are willing to share').setRequired(false)),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        let message = interaction.options.get('message')?.value;
        let channel = interaction.client.channels.cache.get(process.env.HELP_CHANNEL_ID) as TextChannel;
        if (!channel) {
            await interaction.editReply({ content: 'Could not find help channel.' });
            return;
        }
        await channel.send({ content: `Help request: ${message}`, components: [{type: 1, components: [getDeleteMeButton()]}]  });
        await interaction.editReply({ content: 'Help request sent to Bert, if identity was provided you will be contacted. Otherwise look for a generic message in #general when resolved.' });
    },
}