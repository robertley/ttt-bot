import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { createNewPlayer } from "../../modules/player";
import { updateBoardChannel } from "../../modules/bot";

const getUnicode = require('emoji-unicode')

async function isValidImageUrl(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok && response.headers.get('content-type')?.startsWith('image/');
    } catch (error) {
        console.error(`Error checking image URL: ${error}`);
        return false;
    }
}

const EMOJI_REQUIRED = false;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-player-to-game')
        .setDescription('Add a player to the game')
        .addUserOption(option => option.setName('player').setDescription('The player to add').setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('Emoji for the player.')
                .setRequired(EMOJI_REQUIRED)),
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();

        let user = interaction.options.get('player').user;
        try {
            await interaction.editReply(`Adding player ${user.displayName} to the game...`);

            // test emoji
            let emoji = interaction.options.get('emoji')?.value;
            if (!emoji) {
                emoji = '😀';
            }
            const emojiUnicode = getUnicode(emoji).replace(/\s/g, '-');
            
            // Updated URL to the current CDN for Twemoji
            const emojiImage = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiUnicode}.svg`;
            
            // Alternative URL if the above doesn't work
            const emojiImageAlt = `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${emojiUnicode}.png`;
            
            // Check if the emoji image exists
            const isValid = await isValidImageUrl(emojiImage) || await isValidImageUrl(emojiImageAlt);
            
            if (!isValid) {
                await interaction.editReply(`Invalid emoji. Please choose a standard emoji.`);
                return;
            }

            await createNewPlayer(user, interaction.guild, emoji);
            await interaction.editReply(`Player ${user.displayName} added to the game!`);

            setTimeout(async () => {
                await updateBoardChannel(interaction.guild);
            });
        } catch (err) {
            console.error(err);
            await interaction.editReply('There was an error adding the player to the game.');
        }
    },
}