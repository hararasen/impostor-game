
export enum GameStatus {
  LOBBY = 'LOBBY',
  SETUP = 'SETUP',
  NAMES = 'NAMES',
  PASSING = 'PASSING',
  REVEALING = 'REVEALING',
  PLAYING = 'PLAYING'
}

export type GameMode = 'LOCAL' | 'ONLINE';

export interface Player {
  id: string;
  name: string;
  role?: 'impostor' | 'innocent';
  hasSeenRole: boolean;
  isHost?: boolean;
}

export interface LocalGameState {
  status: GameStatus;
  mode: GameMode;
  roomCode?: string;
  players: Player[];
  impostorCount: number;
  currentPlayerIndex: number;
  roundData?: {
    category: string;
    topic: string;
  };
}

export type NetworkMessage = 
  | { type: 'JOIN_REQUEST'; payload: { player: Player } }
  | { type: 'STATE_UPDATE'; payload: { state: LocalGameState } }
  | { type: 'START_GAME'; payload: { roundData: { category: string; topic: string }; players: Player[] } };
