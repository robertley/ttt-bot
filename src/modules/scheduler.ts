import { Guild, TextChannel } from 'discord.js';
import { scheduleJob } from 'node-schedule';
import { givePlayersActionPoints } from './game';
import { Bot } from './bot';
import { getAll, getById, set, truncate } from './database';
import { Settings } from '../interfaces/settings.interface';
import { Player } from '../interfaces/player.interface';
import { Jury } from './jury';
import { queueService } from './queue-service';
import { queryObjects } from 'v8';
import { BotTaskService } from './bot-task-service';
import { Observable } from 'rxjs';
import { BotInteractionService } from './bot-interaction.service';

type ScheduledJob = 'distributeApJob' | 'juryOpenJob';

const jobMap: Map<ScheduledJob, scheduleJob> = new Map()

async function initScheduledJobs(guild: Guild) {
    let settings = await getById<Settings>('settings', guild, '1') as Settings;

    if (!settings) {
        throw new Error(`Settings not found - ${guild.id}`);
    }

    const apScheduleCron = settings.apScheduleCron;
    const juryOpenScheduleCron = settings.juryOpenScheduleCron;
    const apScheduleCron2 = settings.apScheduleCron2;
    const juryOpenScheduleCron2 = settings.juryOpenScheduleCron2;

    await scheduleServerJob('distributeApJob', apScheduleCron, guild);
    if (apScheduleCron2 != null) {
        await scheduleServerJob('distributeApJob', apScheduleCron2, guild);
    }
    await scheduleServerJob('juryOpenJob', juryOpenScheduleCron, guild);
    if (juryOpenScheduleCron2 != null) {
        await scheduleServerJob('juryOpenJob', juryOpenScheduleCron2, guild);
    }
}

async function scheduleServerJob(job: ScheduledJob, cronTime: string, guild: Guild) {
    let jobCallback = jobMap.get(job);
    if (jobCallback) {
        jobCallback.cancel(); // Cancel the existing job if it exists
    }

    console.log(`Scheduling job ${job} with cron time ${cronTime}`);

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

    getAll<Player>('player', guild).then(async playersMap => {
        let jurors = Array.from(playersMap.values()).filter(p => p.health == 0);
        if (jurors.length >= 3) {
            await Jury.finalizeJuryVote(guild);
            await Jury.closeJury(guild);
        }
        BotTaskService.addCommonTask('update-all-secret-channels', guild).subscribe(() => {});
    });
    
}

async function juryOpenJob(guild: Guild) {
    // let players = await getAll('player', guild) as Map<string, Player>;
    // let deadPlayers = Array.from(players.values()).filter(p => p.health <= 0);
    // await truncate('jury-vote', guild);

    // if (deadPlayers.length < 3) {
    //     return;
    // }

    let settings = await getById<Settings>('settings', guild, '1') as Settings;
    settings.juryOpen = true;
    await set('settings', guild, settings);
    
    let channel = guild.channels.cache.get(process.env.JURY_CHANNEL_ID) as TextChannel;
    let message = `<@&${process.env.JURY_ROLE_ID}> Jury vote is open! Please vote using the /ju-vote command`;
    await channel.send({ content: message });
}

export { initScheduledJobs, scheduleServerJob, ScheduledJob };