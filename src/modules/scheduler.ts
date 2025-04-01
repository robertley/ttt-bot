import { Guild } from 'discord.js';
import { scheduleJob } from 'node-schedule';
import { givePlayersActionPoints } from './game';
import { updateAllSecretPlayerChannels } from './bot';
import { getById } from './database';
import { Settings } from '../interfaces/settings.interface';

type ScheduledJob = 'distributeApJob' | 'juryOpenJob';

const jobMap: Map<ScheduledJob, scheduleJob> = new Map()

async function initScheduledJobs(guild: Guild) {
    let settings;
    try {
        let settings = await getById('settings', guild, '1') as Settings;
    } catch {
        console.error('Error fetching settings from database');
        return;
    }

    if (!settings) {
        throw new Error('Settings not found');
    }

    const apScheduleCron = settings.apScheduleCron;
    const juryOpenScheduleCron = settings.juryOpenScheduleCron;

    await scheduleServerJob('distributeApJob', apScheduleCron);
    await scheduleServerJob('juryOpenJob', juryOpenScheduleCron);
}

async function scheduleServerJob(job: ScheduledJob, cronTime: string) {
    let jobCallback = jobMap.get(job);
    if (jobCallback) {
        jobCallback.cancel(); // Cancel the existing job if it exists
    }

    switch (job) {
        case 'distributeApJob':
            jobCallback = distributeApJob;
            break;
        case 'juryOpenJob':
            jobCallback = juryOpenJob;
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