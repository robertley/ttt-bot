import { DBObject } from "./db-object.interface";

export interface Settings extends DBObject {
    apScheduleCron: string;
    juryOpenScheduleCron: string;
    juryOpen: boolean;
    juryMin3Votes: number;
    juryMin4Votes: number;
    juryMin5Votes: number; // unused until more players i guess!
}