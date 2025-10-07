// dotenv config
import 'dotenv/config';

import {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    Partials,
} from 'discord.js';
import path from 'path';
import * as fs from 'fs';
import { initNewServer } from './modules/database';
import { handleVoteButton } from './modules/jury';
import { scheduleJob } from 'node-schedule';
import { giveAP, handleAPButton } from './modules/player';
import { givePlayersActionPoints } from './modules/game';
import { updateAllSecretPlayerChannels } from './modules/bot';
import { initScheduledJobs } from './modules/scheduler';
import { queueService } from './modules/queue-service';
import { resetServer } from './modules/admin';
const TOKEN = process.env.TOKEN;

// TODO
// convert to using settings instead of env variables
// bug with dead log out of order

// #region boilerplate

class ExtendedClient extends Client {
    commands: Collection<string, any>;

    constructor(options: any) {
        super(options);
        this.commands = new Collection();
    }
}

const client = new ExtendedClient({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
});

async function getUsers() {
    // get all users in guild

    const guilds = client.guilds.cache;

    for (let [key, guild] of guilds) {
        let res = await guild.members.fetch();
        res.forEach((member) => {
            console.log(member.user.username);
        });
    }
}

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, async c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);

    await getUsers();
});


client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);

		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// slash commands
client.on(Events.InteractionCreate, async interaction => {
    
    if (interaction.isButton()) {
        try {
            await buttonHandler(interaction);
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `Error: ${error} - contact bertboy` });
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = (interaction.client as ExtendedClient).commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

async function buttonHandler(interaction) {
    if (interaction.customId === 'delete-me') {
        await interaction.message.delete();
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    let idPrefix = interaction.customId.split('-')[0];
    // console.log('button handler', interaction.customId);
    switch (idPrefix) {
        case 'ap':
            await handleAPButton(interaction);
            break;
        case 'confirm':
            if (interaction.customId === 'confirm-reset-server') {
                await resetServer(interaction);
            }
            break;
        
    }
    // handleVoteButton(interaction);
}

// when bot is added to server
client.on(Events.GuildCreate, async guild => {
    await initNewServer(guild);
})
// when message is sent
client.on(Events.MessageCreate, async message => {
    // console.log(message.content);
});

client.login(TOKEN).then(async () => {
    try {
        await initScheduledJobs(client.guilds.cache.first());
    } catch (error) {
        console.error(error);
    }
}).then(() => {
    console.log('Bot is running');
}).catch((error) => {
    console.error('Error logging in:', error);
});

// async function A(print: 'A') {
//     await new Promise((res) => setTimeout(() => res(null), 1000));
//     console.log(print);
//   }
  
//   async function B(print: 'B') {
//     await new Promise((res) => setTimeout(() => res(null), 1000));
//     console.log(print);
//   }
  
//   async function C(print: 'C') {
//     await new Promise((res) => setTimeout(() => res(null), 1000));
//     console.log(print);
//   }

// queueService.addHighPriority(() => A('A'));
// queueService.addHighPriority(() => B('B'));
// queueService.addHighPriority(() => C('C'));

//#endregion


// #region scheduled tasks

// var minutes = .5, the_interval = minutes * 60 * 1000;
// setInterval(function() {
//   console.log("I am doing my .5 minutes check");
//   // do your stuff here
// }, the_interval);

// when guild is initialized init jobs


// const createJuryVoteJob = scheduleJob('*/1 * * * *', async function() {
//     console.log('Checking for jury vote');
//     let guild = client.guilds.cache.first();
//     let juryMembers = guild.roles.cache.get(process.env.JURY_ROLE_ID).members;
//     console.log(juryMembers.size);
//     if (juryMembers.size > 0) {
//         let JURY_VOTE_CHANNEL_ID = process.env.JURY_VOTE_CHANNEL_ID;
//         await createJuryVote(guild);
//         (guild.channels.cache.get(process.env.JURY_CHANNEL_ID) as TextChannel).send({
//             content: `Jury vote has been created. Please vote in <#${JURY_VOTE_CHANNEL_ID}>`,
//         });
//     }
// });