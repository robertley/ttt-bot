import { Guild } from 'discord.js';
import { scheduleJob } from 'node-schedule';
import { givePlayersActionPoints } from './game';
import { updateAllSecretPlayerChannels } from './bot';
import { getById } from './database';
import { Settings } from '../interfaces/settings.interface';

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
            jobCallback = juryOpenJob.bind(this, guild);;
            break;
        default:
            throw new Error('Unknown job type');
    }

    jobMap.set(job, scheduleJob(cronTime, jobCallback));
}

async function distributeApJob(guild: Guild) {
    await givePlayersActionPoints(guild);
    setTimeout(async () => {
        await updateAllSecretPlayerChannels(guild);
    });
}

async function juryOpenJob(guild: Guild) {
    console.log('Jury open job running...');
}

export { initScheduledJobs, scheduleServerJob, ScheduledJob };