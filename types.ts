
export enum GameStatus {
  LOBBY = 'LOBBY',
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

export interface NetworkMessage {
  type: string;
  payload?: any;
}
