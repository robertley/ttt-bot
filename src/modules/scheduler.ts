import { Guild, TextChannel } from 'discord.js';
import { scheduleJob } from 'node-schedule';
import { givePlayersActionPoints } from './game';
import { updateAllSecretPlayerChannels } from './bot';
import { getAll, getById, set, truncate } from './database';
import { Settings } from '../interfaces/settings.interface';
import { Player } from '../interfaces/player.interface';
import { closeJury, finalizeJuryVote } from './jury';
import { queueService } from './queue-service';
import { queryObjects } from 'v8';

type ScheduledJob = 'distributeApJob' | 'juryOpenJob';

const jobMap: Map<ScheduledJob, scheduleJob> = new Map()

async function initScheduledJobs(guild: Guild) {
    let settings = await getById('settings', guild, '1') as Settings;

    if (!settings) {
        throw new Error(`Settings not found - ${guild.id}`);
    }

    const apScheduleCron = settings.apScheduleCron;
    const juryOpenScheduleCron = settings.juryOpenScheduleCron;

    await scheduleServerJob('distributeApJob', apScheduleCron, guild);
    await scheduleServerJob('juryOpenJob', juryOpenScheduleCron, guild);
}

async function scheduleServerJob(job: ScheduledJob, cronTime: string, guild: Guild) {
    let jobCallback = jobMap.get(job);
    if (jobCallback) {
        jobCallback.cancel(); // Cancel the existing job if it exists
    }

    switch (job) {
        case 'distributeApJob':
            jobCallback = distributeApJob.bind(this, guild);
            break;
        case 'juryOpenJob':
            console.log(`Scheduling job ${job} with cron time ${cronTime}`);
            jobCallback = juryOpenJob.bind(this, guild);;
            break;
        default:
            throw new Error('Unknown job type');
    }

    jobMap.set(job, scheduleJob(cronTime, jobCallback));
}

async function distributeApJob(guild: Guild) {
    queueService.addHighPriority(async () => { await finalizeJuryVote(guild) });
    queueService.addHighPriority(async () => { await closeJury(guild) });
    queueService.addToQueue(async () => { await givePlayersActionPoints(guild) });
    queueService.addLowPriority(async () => { await updateAllSecretPlayerChannels(guild) });
    

    // close the jury vote if it is open
    let settings = await getById('settings', guild, '1') as Settings;
    if (settings.juryOpen) {
        settings.juryOpen = false;
        await set('settings', guild, settings);
    }
}

async function juryOpenJob(guild: Guild) {
    let players = await getAll('player', guild) as Map<string, Player>;
    let deadPlayers = Array.from(players.values()).filter(p => p.health <= 0);
    await truncate('jury-vote', guild);

    if (deadPlayers.length < 3) {
        return;
    }

    let settings = await getById('settings', guild, '1') as Settings;
    settings.juryOpen = true;
    await set('settings', guild, settings);
    
    let channel = guild.channels.cache.get(process.env.JURY_CHANNEL_ID) as TextChannel;
    let message = `<@&${process.env.JURY_ROLE_ID}> Jury vote is open! Please vote using the /ju-vote command`;
    await channel.send({ content: message });
}

export { initScheduledJobs, scheduleServerJob, ScheduledJob };