import { DBObject } from "./db-object.interface";

export interface Settings extends DBObject {
    apScheduleCron: string;
    juryOpenScheduleCron: string;
    juryOpen: boolean;
}