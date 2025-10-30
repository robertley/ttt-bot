import { ButtonInteraction, CategoryChannel } from "discord.js";
import { Player } from "../interfaces/player.interface";
import { getAll, initNewServer } from "./database";
import { SecretChannelCategory } from "../interfaces/secret-channel-category.interface";

async function resetServer(interaction: ButtonInteraction) {
    // delete player secret channels
    let players: Map<string, Player> = await getAll('player', interaction.guild) as Map<string, Player>;
    for (let [id, player] of players) {
        if (player.secretChannelId) {
            try {
                let channel = await interaction.guild.channels.fetch(player.secretChannelId);
                if (channel) {
                    await channel.delete();
                }
            } catch (e) {
                // channel already deleted
            }

        }

        if (player.notifcationChannelId) {
            try {
                let channel = await interaction.guild.channels.fetch(player.notifcationChannelId);
                if (channel) {
                    await channel.delete();
                }
            } catch (e) {
                // channel already deleted
            }
        }
    }

    // delete secret channel categories
    let secretChannelCategories = await getAll('secret-channel-category', interaction.guild) as Map<string, SecretChannelCategory>;
    for (let [id, category] of secretChannelCategories) {
        let categoryChannel: CategoryChannel = await interaction.guild.channels.fetch(id).catch(() => null);
        if (categoryChannel) {
            for (let channel of categoryChannel.children.cache.values()) {
                await channel.delete();
            }
            await categoryChannel.delete();
        }
    }

    // delete all database entries and re-initialize the server
    await initNewServer(interaction.guild);


    await interaction.editReply('Done');
}

export { resetServer };