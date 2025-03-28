import { DBObject } from "./db-object.interface";

export interface Player extends DBObject {
    username: string;
    actionPoints: number;
    health: number;
    range: number;
    emoji: string;
    secretChannelId: string;
    diedDate: Date;
    kills: string[];
}