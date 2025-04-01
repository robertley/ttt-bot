import { Client, Guild } from "discord.js";
import { existsSync, mkdirSync, readFile, writeFile } from "node:fs";
import { makeEmptyBoard } from "./board";
import { DBObject } from "../interfaces/db-object.interface";
import { env } from "node:process";
import { Settings } from "../interfaces/settings.interface";
import { updateSettingsChannel } from "./bot";

export type DBKey = 'board' | 'player' | 'game' | 'jury-vote' | 'player-name-record' | 'settings';

async function initNewServer(guild: Guild) {
    const directory = `./data/${guild.id}`;
    try {
        if (!existsSync(directory)) {
          mkdirSync(directory);
        }

    } catch (err) {
        console.error(err);
    }

    await initFiles(guild);

    // find all players with Player Role and Jury Role and remove those roles
    let playerRole  = await guild.roles.fetch(process.env.PLAYER_ROLE_ID);
    let juryRole = await guild.roles.fetch(process.env.JURY_ROLE_ID);
    let players = guild.members.cache.filter(member => member.roles.cache.has(process.env.PLAYER_ROLE_ID) || member.roles.cache.has(process.env.JURY_ROLE_ID));
    players.forEach(async player => {
        await player.roles.remove(playerRole);
        await player.roles.remove(juryRole);
    });

}

async function initFiles(guild: Guild) {
    await truncate('board', guild);
    await truncate('player', guild);
    await truncate('game', guild);
    await truncate('jury-vote', guild);
    if (!existsSync(`./data/${guild.id}/player-name-record.json`)) {
        await truncate('player-name-record', guild);
    }
    if (!existsSync(`./data/${guild.id}/settings.json`)) {
        await truncate('settings', guild);
        let settings: Settings = {
            id: '1',
            apScheduleCron: '0 12 * * *',
            juryOpenScheduleCron: '0 14 * * *',
        }
        await set('settings', guild, settings);
        await updateSettingsChannel(guild);
    }
}

async function getObjectFromFile(path: string): Promise<Map<string, DBObject>> {
    return new Promise(async (resolve, reject) => {
        await readFile(path, 'utf8', async (err, data) => {
            if (err){
                reject(err);
            } else {
                if (data == '') {
                    resolve(null); 
                    return;
                }
                let object = JSON.parse(data, reviver);
                resolve(object);
            }
        });
    });
}

async function writeObjectToFile(filePath, object) {
    return new Promise(async (resolve, reject) => {
        let objectString = JSON.stringify(object, replacer);
        await writeFile(filePath, objectString, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(null);
            }
        });
    });
}

function replacer(key, value) {
    if (value instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(value.entries()), // or with spread: value: [...value]
        };
    } else {
        return value;
    }
}

function reviver(key, value) {
    if(typeof value === 'object' && value !== null) {
        if (value.dataType === 'Map') {
            return new Map(value.value);
        }
    }
    return value;
}

async function getAll(key: DBKey, guild: Guild): Promise<Map<string, DBObject>> {
    let path = `./data/${guild.id}/${key}.json`;
    return await getObjectFromFile(path);
}

async function getById(key: DBKey, guild: Guild, id: string = '1'): Promise<DBObject> {
    let objects = await getAll(key, guild);
    return objects.get(id);
}

async function set(key: DBKey, guild: Guild, object: DBObject | DBObject[]) {
    let path = `./data/${guild.id}/${key}.json`;
    let objects = await getAll(key, guild);
    // console.log(objects.keys());
    // if objects is an empty map, we need to initialize it
    if (Array.from(objects.keys()).length == 0) {
        // console.log('Initializing empty map');
        objects = new Map();
    }

    // console.log(objects);
    
    let persistObjects = [];
    if (Array.isArray(object)) {
        persistObjects = object;
    } else {
        persistObjects.push(object);
    }

    persistObjects.forEach((object) => {
        objects.set(object.id, object);
    });

    await writeObjectToFile(path, objects);
}

async function truncate(key: DBKey, guild: Guild) {
    let path = `./data/${guild.id}/${key}.json`;
    await writeObjectToFile(path, new Map());
}

export { initNewServer, getAll, set, getById, truncate }