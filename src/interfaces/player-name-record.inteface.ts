import { DBObject } from "./db-object.interface";

export interface PlayerNameRecord extends DBObject {
    name: string;
}