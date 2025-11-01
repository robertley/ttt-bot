import { Observable, Subject, Subscription } from "rxjs";
import { ActionResponse } from "../interfaces/action-response.interace";
import { Guild } from "discord.js";
import { Bot } from "./bot";

const DEV = process.env.DEV === 'true';

export interface Task<T> {
    fn: () => Observable<T>;
    priority: 'low' | 'high';
    date?: Date; // used as the identifier and for ordering
    name: string;
    dataBaseFn?: (resp: T) => Promise<void>; // Optional function to interact with the database
    playerId?: string; // Optional user ID associated with the task
    skipTimeout?: boolean; // If true, the task will not be subject to timeout delays
    taskId?: 'update-all-secret-channels' | 'update-board-channel'; // Optional ID associated with the task
}

export interface AddTaskResult<T> {
    date: Date;
    resp: T;
    error?: 'timeout' | 'task function failure';
    timeRemaining?: number;
}

let currentTask: Task<any> = null;
let currentTaskSubs: Subscription = null;
const taskSubjMap: Map<Date, Subject<any>> = new Map();
const playerLastTaskMap: Map<string, number> = new Map();

const taskQueue: Task<any>[] = [];
const taskDelay = DEV ? 500 : 5000;

function addTask(task: Task<any>): Subject<AddTaskResult<any>> {

    if (!task.date) {
        task.date = new Date();
    }

    let returnSubj = new Subject<AddTaskResult<any>>();
    taskSubjMap.set(task.date, returnSubj);

    console.log(`Adding task ${task.name} with priority ${task.priority}`);

    if (task.playerId && !task.skipTimeout) {
        let now = Date.now();
        let lastTaskTime = playerLastTaskMap.get(task.playerId) || 0;
        let timeRemaining = taskDelay - (now - lastTaskTime);
        if (timeRemaining > 0) {
            setTimeout(() => {
                returnSubj.next({ date: task.date, resp: null, error: 'timeout', timeRemaining: timeRemaining });
                returnSubj.complete();
                taskSubjMap.delete(task.date);
            })
            return returnSubj;
        }
    }

    if (task.taskId === 'update-all-secret-channels') {
        let existingTaskIndex = taskQueue.findIndex(t => t.taskId === 'update-all-secret-channels');
        if (existingTaskIndex !== -1) {
            console.log('An update-all-secret-channels task is already in the queue, ignoring this one.');
            return;
        }
    }

    if (task.taskId === 'update-board-channel') {
        let existingTaskIndex = taskQueue.findIndex(t => t.taskId === 'update-board-channel');
        if (existingTaskIndex !== -1) {
            console.log('An update-board-channel task is already in the queue, ignoring this one.');
            return;
        }
    }

    taskQueue.push(task);

    if (currentTask == null) {
        console.log('No current task, processing tasks immediately.');
        processTasks();
        return returnSubj;
    }

    if (currentTask.priority === 'low' && task.priority === 'high') {
        console.log(`Preempting task ${currentTask.name} for high-priority task ${task.name}`);
        currentTaskSubs.unsubscribe();
        taskQueue.unshift(currentTask);
        currentTask = null;
        processTasks();
    }

    return returnSubj;
    // else do nothing, task will be processed in turn
}

function processTasks() {
    console.log('Processing tasks...', taskQueue.length, 'tasks in queue.');
    if (taskQueue.length === 0) return;

    taskQueue.sort((a, b) => {
        if (a.priority === b.priority) {
            return a.date.getTime() - b.date.getTime();
        }
        return a.priority === 'high' ? -1 : 1;
    });

    const task = taskQueue.shift();

    console.log(`Starting task ${task.name} with priority ${task.priority}`);

    currentTask = task;

    currentTaskSubs = task.fn().subscribe({
        next: async (resp) => {
            console.log(`Task ${task.name} completed successfully.`);
            // console.log(resp && ('success' in resp) && resp.success == false);
            let subj = taskSubjMap.get(task.date);

            // if task fails in task function
            if (resp && typeof resp === 'object' && ('success' in resp) && resp.success == false) {
                subj?.next({ date: task.date, resp: resp, error: 'task function failure' });
                subj?.complete();
                taskSubjMap.delete(task.date);
                currentTask = null;
                processTasks();
                return;
            }

            if (task.playerId) {
                let now = Date.now();
                playerLastTaskMap.set(task.playerId, now);
            }

            await task.dataBaseFn?.(resp);

            subj?.next({ date: task.date, resp: resp });
            taskSubjMap.delete(task.date);
            currentTaskSubs.unsubscribe();
            currentTask = null;
            console.log('Task processing complete.')
            processTasks();
        },
        error: (err) => {
            console.error(`Task ${task.name} failed:`, err);
            let subj = taskSubjMap.get(task.date);
            subj.error(err);
            subj.complete();
            currentTask = null;
            processTasks();
        }
    });
    
}

function addCommonTask(task: 'update-all-secret-channels' | 'update-board-channel', guild: Guild): Observable<AddTaskResult<any>> {
    return new Observable<AddTaskResult<any>>(sub => {
        let fn;
        let priority: 'low' | 'high' = 'low'; // pretty sure this should never be high priority in 'common tasks'
        let name = null;
        let taskId = null;   
        switch (task) {
            case 'update-all-secret-channels':
                fn = () => Bot.updateAllSecretPlayerChannels(guild);
                name = `update all secret channels`;
                taskId = `update-all-secret-channels`;
                break;
            case 'update-board-channel':
                fn = () => Bot.updateBoardChannel(guild);
                name = `update board channel`;
                taskId = `update-board-channel`;
                break;
            
        }

        addTask({
            fn: fn,
            priority: priority,
            name: name,
            taskId: taskId
        })//?.subscribe((resp) => { wont return sub when ignoring duplicates
            // this locks up the bot
            // not sure why... might need to fix this later but for now don't need to know when common task is done
            // sub.next(resp);
            // sub.complete();
        //});
        sub.next(null);
        sub.complete();
    });
}

export const BotTaskService = {
    addTask,
    addCommonTask,
};