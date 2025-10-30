import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { createNewPlayer } from "../../modules/player";
import { updateBoardChannel } from "../../modules/bot";
import { set } from "../../modules/database";
import { PlayerNameRecord } from "../../interfaces/player-name-record.inteface";


module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-player-to-name-records')
        .setDescription('Add a player to name records so weff can dox them')
        .addUserOption(option => option.setName('player').setDescription('The player to add').setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('name of player')
                .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        let user = interaction.options.get('player').user;

        let name = interaction.options.get('name').value as string;

        set('player-name-record', interaction.guild, {
            id: user.id,
            name: name,
        } as PlayerNameRecord).then(async () => {
            await interaction.editReply({ content: `Added ${user} to name records with name ${name}` });
        }).catch(async (err) => {
            console.error(err);
            await interaction.editReply({ content: `Error adding ${user} to name records` });
        });

    },
}