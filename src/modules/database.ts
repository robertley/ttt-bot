import { Client, Guild } from "discord.js";
import { existsSync, mkdirSync, readFile, writeFile } from "node:fs";
import { makeEmptyBoard } from "./board";
import { DBObject } from "../interfaces/db-object.interface";

export type DBKey = 'board' | 'player' | 'game' | 'jury-vote';

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
}

async function initFiles(guild: Guild) {
    truncate('board', guild);
    truncate('player', guild);
    truncate('game', guild);
    truncate('jury-vote', guild);
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

async function getById(key: DBKey, guild: Guild, id: string) {
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