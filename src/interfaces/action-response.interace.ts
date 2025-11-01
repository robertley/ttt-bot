import { Board } from "./board.interface";
import { Player } from "./player.interface";

export interface ActionResponse {
    success: boolean;
    action: 'move' | 'attack' | 'heal' | 'death' | 'scheduled-ap' | 'range-upgrade' | 'give-ap' | 'give-ap-far' | 'new-game' | 'jury-vote' | 'jury-fail';
    data?: (MoveData | AttackData | JuryData) & { target?: Player };
    error?: 'no AP' | 'invalid',
    message?: string;
    player?: Player;
    board?: Board;
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