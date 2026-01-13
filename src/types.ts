// Game States
export type GameState = 'menu' | 'playing' | 'gameover' | "countdown";

// Component Props
export interface GameUIProps {
  killCount: number;
  buffTimerValue: number;
  soundBtnLabelOn: boolean;
  onSoundToggle: () => void;
  onStopGame: () => void;
  volume: number;
  onVolumeChange: (value: number) => void;
}

export interface TransactionsTableProps {
  transactions: Transaction[];
  clearTransactions?: () => void;
}

export interface LeaderboardPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ProvidersProps {
  children: React.ReactNode;
}

// Game Objects
export interface Transaction {
  id: number;
  type: string;
  link: string;
  date: number;
  error?: string;
  userAddress?: string;
}

export interface LeaderboardRecord {
  id: string;
  score: number;
  tx: string;
  address: string;
  hash_tx: string;
  url: string;
  total_score?: number;
  username?: string;
}

export interface ImageCache {
  enemies: {
    [key: string]: HTMLImageElement;
  };
  fire: {
    [key: string]: HTMLImageElement;
  };
  player: {
    [key: string]: HTMLImageElement;
  };
}

// Game Stats
export interface GameStats {
  totalScore: number;
  killCount: number;
  fireMondalakKillKount: number;
  damageTaken: number;
  damageGiven: number;
  healsUsed: number;
  buffsTaken: number;
}

// Game Controls
export interface GameKeys {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
}

export interface GameMouse {
  x: number;
  y: number;
  shooting: boolean;
}

// Game Objects
export interface Explosion {
  x: number;
  y: number;
  frame: number;
  width: number;
  height: number;
}

// Hook Return Types
export interface UseTransactionsReturn {
  transactions: Transaction[];
  handleMint: (killCount: number) => void;
  handleTotalScore: (score: number, isDead: boolean) => void;
  handleFaucet: (address: string) => Promise<void>;
  clearTransactions: () => void;
}

// Utils Types
export type LeaderboardResponse = {
  url?: string;
  error: string;
  mon?: number;
  tx?: string;
  userAddress?: string;
  deadline_seconds?: number;
};

export interface UpdateTransactionCallback {
  (): Promise<LeaderboardResponse>;
}

// Error Types
export interface ApiError {
  detail: string;
} 