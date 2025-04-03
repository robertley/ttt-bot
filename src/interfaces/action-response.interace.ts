import { Player } from "./player.interface";

export interface ActionResponse {
    success: boolean;
    action: 'move' | 'attack' | 'heal' | 'death' | 'scheduled-ap' | 'range-upgrade' | 'give-ap' | 'new-game' | 'jury-vote' | 'jury-fail';
    data?: MoveData | AttackData | JuryData;
    error?: 'no energy' | 'invalid',
    message?: string;
    player?: Player;
}

export interface MoveData {
    direction: 'up' | 'down' | 'left' | 'right';
}

export interface AttackData {
    target: Player;
}

export interface JuryData {
    winners: Player[];
}