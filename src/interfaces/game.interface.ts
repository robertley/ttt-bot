import { DBObject } from "./db-object.interface";

export interface Game extends DBObject {
    boardId: string;
    playerIds: string[];
    dateStarted: Date;
    dateEnded: Date;
    winnerId: string;
}