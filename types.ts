export enum GameStatus {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  REVEAL = 'REVEAL',
  ENDED = 'ENDED'
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  role?: 'impostor' | 'innocent';
  isReady?: boolean;
}

export interface GameState {
  roomCode: string;
  status: GameStatus;
  players: Player[];
  settings: {
    impostorCount: number;
  };
  roundData?: {
    category: string;
    topic: string; // Hidden from impostors
  };
}

export type NetworkMessage =
  | { type: 'JOIN_REQUEST'; payload: { name: string; roomCode: string; playerId: string } }
  | { type: 'STATE_UPDATE'; payload: GameState }
  | { type: 'START_GAME'; payload: { category: string; topic: string; impostorIds: string[] } }
  | { type: 'RESET_GAME'; payload: null };
