
export enum GameStatus {
  SETUP = 'SETUP',
  NAMES = 'NAMES',
  PASSING = 'PASSING',
  REVEALING = 'REVEALING',
  PLAYING = 'PLAYING'
}

export interface Player {
  id: string;
  name: string;
  role?: 'impostor' | 'innocent';
  hasSeenRole: boolean;
}

export interface LocalGameState {
  status: GameStatus;
  players: Player[];
  impostorCount: number;
  currentPlayerIndex: number;
  roundData?: {
    category: string;
    topic: string;
  };
}

/**
 * Added NetworkMessage type to fix: Module '"../types.ts"' has no exported member 'NetworkMessage'.
 * This defines the protocol for peer-to-peer game state updates and requests.
 */
export type NetworkMessage = 
  | { type: 'JOIN_REQUEST'; payload: { roomCode: string } }
  | { type: 'STATE_UPDATE'; payload: { roomCode: string; state: LocalGameState } }
  | { type: string; payload: any };
