import { DBObject } from "./db-object.interface";

export interface Player extends DBObject {
    displayName: string;
    actionPoints: number;
    health: number;
    range: number;
    emoji: string;
    secretChannelId: string;
    diedDate: number;
    kills: string[];
    brainOrBrawn: 'brain' | 'brawn';
}