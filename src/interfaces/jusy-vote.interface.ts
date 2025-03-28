import { DBObject } from "./db-object.interface";

export interface JuryVote extends DBObject {
    vote: string;
}