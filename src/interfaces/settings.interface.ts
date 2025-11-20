import { DBObject } from "./db-object.interface";

export interface Settings extends DBObject {
    apScheduleCron: string;
    apScheduleCron2: string;
    juryOpenScheduleCron: string;
    juryOpenScheduleCron2: string;
    juryOpen: boolean;
    juryMin3Votes: number;
    juryMin4Votes: number;
    juryMin5Votes: number;
}