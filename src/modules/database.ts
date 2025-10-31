import { Client, Guild } from "discord.js";
import { createWriteStream, existsSync, mkdirSync, readFile, unlink, writeFile } from "node:fs";
import { DBObject } from "../interfaces/db-object.interface";
import { Settings } from "../interfaces/settings.interface";
import { Bot } from "./bot";
import { get } from "node:https";
const getUnicode = require('emoji-unicode')


export type DBKey = 'board' | 'player' | 'game' | 'jury-vote' | 'jury-vote-backup' | 'player-name-record' | 'settings' | 'secret-channel-category';

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

    downloadEmojis();
}

function downloadEmojis() {
    let hitUrl = 'https://twitter.github.io/twemoji/v/13.1.0/72x72/1f4a5.png';
    let emojiUnicode = getUnicode('⚔').replace(/\s/g, '-');
    let attackUrl = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${emojiUnicode}.png`;
    let skullUnicode = getUnicode('💀').replace(/\s/g, '-');
    let skullUrl = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${skullUnicode}.png`;
    let upUnicode = getUnicode('🔼').replace(/\s/g, '-');
    let upUrl = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${upUnicode}.png`;
    let downUnicode = getUnicode('🔽').replace(/\s/g, '-');
    let downUrl = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${downUnicode}.png`;
    let leftUnicode = getUnicode('◀').replace(/\s/g, '-');
    let leftUrl = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${leftUnicode}.png`;
    let rightUnicode = getUnicode('▶').replace(/\s/g, '-');
    let rightUrl = `https://twitter.github.io/twemoji/v/13.1.0/72x72/${rightUnicode}.png`;
    
    downloadImageFromCDN(hitUrl, `./data/emojis/hit.png`).then((message) => {
        console.log(message);
    }).catch((err) => {
        console.error(`Error downloading hit emoji image: ${err}`);
    });
    downloadImageFromCDN(attackUrl, `./data/emojis/attack.png`).then((message) => {
        console.log(message);
    }).catch((err) => {
        console.error(`Error downloading attack emoji image: ${err}`);
    });
    downloadImageFromCDN(skullUrl, `./data/emojis/skull.png`).then((message) => {
        console.log(message);
    }).catch((err) => {
        console.error(`Error downloading skull emoji image: ${err}`);
    });
    downloadImageFromCDN(upUrl, `./data/emojis/up.png`).then((message) => {
        console.log(message);
    }).catch((err) => {
        console.error(`Error downloading up emoji image: ${err}`);
    });
    downloadImageFromCDN(downUrl, `./data/emojis/down.png`).then((message) => {
        console.log(message);
    }).catch((err) => {
        console.error(`Error downloading down emoji image: ${err}`);
    });
    downloadImageFromCDN(leftUrl, `./data/emojis/left.png`).then((message) => {
        console.log(message);
    }).catch((err) => {
        console.error(`Error downloading left emoji image: ${err}`);
    });
    downloadImageFromCDN(rightUrl, `./data/emojis/right.png`).then((message) => {
        console.log(message);
    }).catch((err) => {
        console.error(`Error downloading right emoji image: ${err}`);
    });
}

async function initFiles(guild: Guild) {
    await truncate('board', guild);
    await truncate('player', guild);
    await truncate('game', guild);
    await truncate('jury-vote', guild);
    await truncate('jury-vote-backup', guild);
    await truncate('secret-channel-category', guild);
    if (!existsSync(`./data/${guild.id}/player-name-record.json`)) {
        await truncate('player-name-record', guild);
    }
    if (!existsSync(`./data/${guild.id}/settings.json`)) {
        await truncate('settings', guild);
        let settings: Settings = {
            id: '1',
            apScheduleCron: '0 12 * * *',
            juryOpenScheduleCron: '0 14 * * *',
            juryOpen: false,
            juryMin3Votes: 3,
            juryMin4Votes: 9,
            juryMin5Votes: 99
        }
        await set('settings', guild, settings);
        await Bot.updateSettingsChannel(guild);
    }

    const whispersPath = `./data/${guild.id}/whispers.txt`;
    if (!existsSync(whispersPath)) {
        writeFile(whispersPath, '', (err) => {
            if (err) {
                console.error(`Error creating whispers.txt file: ${err}`);
            } else {
                console.log(`whispers.txt file created at ${whispersPath}`);
            }
        });
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

async function getAll<T>(key: DBKey, guild: Guild): Promise<Map<string, T>> {
    let path = `./data/${guild.id}/${key}.json`;
    return await getObjectFromFile(path) as Map<string, T>;
}

async function getById<T>(key: DBKey, guild: Guild, id: string = '1'): Promise<T> {
    let objects = await getAll(key, guild);
    return objects.get(id) as T;
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

async function downloadImageFromCDN(cdnUrl, localPath) {
    return new Promise((resolve, reject) => {
        const fileStream = createWriteStream(localPath);

        get(cdnUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get image from CDN. Status code: ${response.statusCode}`));
                return;
            }

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve(`Image downloaded and saved to: ${localPath}`);
            });

            fileStream.on('error', (err) => {
                unlink(localPath, () => {}); // Delete incomplete file
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function pushToWhispersLog(guild: Guild, message: string) {
    const whispersPath = `./data/${guild.id}/whispers.txt`;
    return new Promise(async (resolve, reject) => {
        await readFile(whispersPath, 'utf8', async (err, data) => {
            if (err){
                reject(err);
            } else {
                let newData = data + message + '\n';    
                await writeFile(whispersPath, newData, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(null);
                    }
                });
            }
        });
    });
}

export { initNewServer, getAll, set, getById, truncate, downloadImageFromCDN, pushToWhispersLog }