import type { GameType } from "./game";

export const PLAYER_COLORS = [
  "#ff5d47",
  "#46d9ff",
  "#c9f24a",
  "#ffbd3d",
  "#ff7ad9",
  "#4ef0b5",
] as const;

export function colorFor(slot: number) {
  return PLAYER_COLORS[slot % PLAYER_COLORS.length];
}

export const GAME_META: Record<
  GameType,
  { title: string; players: string; blurb: string; accent: string }
> = {
  snakesladders: {
    title: "Snakes & Ladders",
    players: "2–6 players",
    blurb: "Race to square 100. Ladders lift you, snakes drag you back.",
    accent: "#c9f24a",
  },
  tictactoe: {
    title: "Tic Tac Toe",
    players: "2 players",
    blurb: "Three in a row. Fast, brutal, endlessly replayable.",
    accent: "#46d9ff",
  },
  dice: {
    title: "Dice Duel",
    players: "2–6 players",
    blurb: "Push your luck to 100. Bust on 1, six keeps your turn.",
    accent: "#ffbd3d",
  },
  connect4: {
    title: "Connect Four",
    players: "2 players",
    blurb: "Drop discs. Line up four before they do.",
    accent: "#ff7ad9",
  },
  rps: {
    title: "RPS Duel",
    players: "2 players",
    blurb: "First to three. Lock in. Reveal. Rematch.",
    accent: "#4ef0b5",
  },
};

export const GAME_ORDER: GameType[] = [
  "snakesladders",
  "tictactoe",
  "dice",
  "connect4",
  "rps",
];
