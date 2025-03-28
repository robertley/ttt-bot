import { DBObject } from "./db-object.interface";

export interface Board extends DBObject{
    tile: string[][];
}