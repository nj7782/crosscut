export type GameType =
  | "tictactoe"
  | "dice"
  | "snakesladders"
  | "connect4"
  | "rps";

/** Seat index inside a room. 0–1 for duels, 0–5 for Snakes & Ladders. */
export type Slot = number;
export type Mark = "X" | "O";
export type Cell = Mark | null;

export type Player = {
  id: string;
  name: string;
  slot: Slot;
  /** Portrait id from the CrossCut avatar roster. */
  avatar: string;
};

export const MAX_PLAYERS: Record<GameType, number> = {
  tictactoe: 2,
  dice: 6,
  snakesladders: 6,
  connect4: 2,
  rps: 2,
};

export const MIN_PLAYERS: Record<GameType, number> = {
  tictactoe: 2,
  dice: 2,
  snakesladders: 2,
  connect4: 2,
  rps: 2,
};

export const GAME_LABELS: Record<GameType, string> = {
  tictactoe: "Tic Tac Toe",
  dice: "Dice Duel",
  snakesladders: "Snakes & Ladders",
  connect4: "Connect Four",
  rps: "RPS Duel",
};

export function isGameType(value: unknown): value is GameType {
  return (
    value === "tictactoe" ||
    value === "dice" ||
    value === "snakesladders" ||
    value === "connect4" ||
    value === "rps"
  );
}

/* ---------------------------------- codes --------------------------------- */

export function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function generatePlayerId(): string {
  return crypto.randomUUID();
}

function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/* ------------------------------- tic tac toe ------------------------------ */

export type TicTacToeState = {
  kind: "tictactoe";
  board: Cell[];
  turn: Slot;
  winner: Slot | "draw" | null;
  winningLine: number[] | null;
};

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function markFor(slot: Slot): Mark {
  return slot === 0 ? "X" : "O";
}

export function createTicTacToe(firstTurn: Slot = 0): TicTacToeState {
  return {
    kind: "tictactoe",
    board: Array(9).fill(null),
    turn: firstTurn,
    winner: null,
    winningLine: null,
  };
}

export function applyTicTacToeMove(
  state: TicTacToeState,
  slot: Slot,
  index: number,
): string | null {
  if (state.winner !== null) return "Game already finished.";
  if (state.turn !== slot) return "Not your turn.";
  if (!Number.isInteger(index) || index < 0 || index > 8) return "Invalid square.";
  if (state.board[index] !== null) return "Square already taken.";

  state.board[index] = markFor(slot);

  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (
      state.board[a] &&
      state.board[a] === state.board[b] &&
      state.board[a] === state.board[c]
    ) {
      state.winner = slot;
      state.winningLine = [...line];
      return null;
    }
  }

  if (state.board.every((cell) => cell !== null)) {
    state.winner = "draw";
    return null;
  }

  state.turn = slot === 0 ? 1 : 0;
  return null;
}

/* ------------------------------- dice duel -------------------------------- */

export type DiceEvent = "roll" | "bust" | "bank" | "again" | null;

export type DiceState = {
  kind: "dice";
  status: "lobby" | "playing" | "over";
  target: number;
  scores: number[];
  pot: number;
  turn: Slot;
  lastRoll: number | null;
  lastRollBy: Slot | null;
  /** Face value added to the pot on the last roll (0 on bust). */
  lastGain: number;
  /** Amount banked on the last bank action. */
  lastBank: number;
  lastEvent: DiceEvent;
  rollId: number;
  winner: Slot | null;
};

/** Race target. */
export const DICE_TARGET = 100;

export function createDice(playerCount = 1): DiceState {
  return {
    kind: "dice",
    status: "lobby",
    target: DICE_TARGET,
    scores: Array(Math.max(playerCount, 1)).fill(0),
    pot: 0,
    turn: 0,
    lastRoll: null,
    lastRollBy: null,
    lastGain: 0,
    lastBank: 0,
    lastEvent: null,
    rollId: 0,
    winner: null,
  };
}

export function startDice(
  state: DiceState,
  playerCount: number,
  firstTurn: Slot = 0,
): string | null {
  if (state.status !== "lobby") return "The game already started.";
  if (playerCount < MIN_PLAYERS.dice) {
    return "Need at least 2 players to start.";
  }
  state.scores = Array(playerCount).fill(0);
  state.status = "playing";
  state.pot = 0;
  state.turn = firstTurn % playerCount;
  state.lastRoll = null;
  state.lastRollBy = null;
  state.lastGain = 0;
  state.lastBank = 0;
  state.lastEvent = null;
  state.winner = null;
  return null;
}

function advanceDiceTurn(state: DiceState, playerCount: number) {
  const count = Math.max(playerCount, 1);
  state.turn = (state.turn + 1) % count;
}

function ensureScoreSlots(state: DiceState, playerCount: number) {
  while (state.scores.length < playerCount) state.scores.push(0);
}

/**
 * Simple Pig-style math (no multiplying):
 * - Roll 2–6: pot = pot + face
 * - Roll 6: same + keep turn (roll again)
 * - Roll 1: pot = 0, turn ends
 * - Bank: score += pot, pot = 0, turn ends
 */
export function applyDiceAction(
  state: DiceState,
  slot: Slot,
  action: "roll" | "bank",
  playerCount: number,
): string | null {
  if (state.status === "lobby") return "Waiting for the host to start.";
  if (state.status === "over" || state.winner !== null) {
    return "Game already finished.";
  }
  if (state.turn !== slot) return "Not your turn.";

  ensureScoreSlots(state, playerCount);
  if (typeof state.lastGain !== "number") state.lastGain = 0;
  if (typeof state.lastBank !== "number") state.lastBank = 0;

  state.rollId += 1;

  if (action === "roll") {
    const value = rollDie();
    state.lastRoll = value;
    state.lastRollBy = slot;
    state.lastBank = 0;

    if (value === 1) {
      state.pot = 0;
      state.lastGain = 0;
      state.lastEvent = "bust";
      advanceDiceTurn(state, playerCount);
      return null;
    }

    state.pot += value;
    state.lastGain = value;
    state.lastEvent = value === 6 ? "again" : "roll";
    return null;
  }

  if (state.pot === 0) return "Roll before you bank.";

  const banked = state.pot;
  state.scores[slot] = (state.scores[slot] ?? 0) + banked;
  state.pot = 0;
  state.lastGain = 0;
  state.lastBank = banked;
  state.lastEvent = "bank";
  state.lastRollBy = slot;

  if (state.scores[slot] >= state.target) {
    state.winner = slot;
    state.status = "over";
  } else {
    advanceDiceTurn(state, playerCount);
  }
  return null;
}

/* ---------------------------- snakes & ladders ---------------------------- */

export const LADDERS: Record<number, number> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
};

export const SNAKES: Record<number, number> = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

export type LadderEvent = {
  slot: Slot;
  roll: number;
  from: number;
  landed: number;
  to: number;
  kind: "move" | "ladder" | "snake" | "blocked" | "win";
};

export type SnakesLaddersState = {
  kind: "snakesladders";
  status: "lobby" | "playing" | "over";
  positions: number[];
  turn: Slot;
  rollsLeft: number;
  lastEvent: LadderEvent | null;
  rollId: number;
  winner: Slot | null;
};

export function createSnakesLadders(playerCount = 1): SnakesLaddersState {
  return {
    kind: "snakesladders",
    status: "lobby",
    positions: Array(Math.max(playerCount, 1)).fill(0),
    turn: 0,
    rollsLeft: 1,
    lastEvent: null,
    rollId: 0,
    winner: null,
  };
}

export function startSnakesLadders(
  state: SnakesLaddersState,
  playerCount: number,
  firstTurn: Slot = 0,
): string | null {
  if (state.status !== "lobby") return "The game already started.";
  if (playerCount < MIN_PLAYERS.snakesladders) {
    return "Need at least 2 players to start.";
  }
  state.positions = Array(playerCount).fill(0);
  state.status = "playing";
  state.turn = firstTurn % playerCount;
  state.rollsLeft = 1;
  state.lastEvent = null;
  return null;
}

export function applySnakesLaddersRoll(
  state: SnakesLaddersState,
  slot: Slot,
  playerCount: number,
): string | null {
  if (state.status === "lobby") return "Waiting for the host to start.";
  if (state.status === "over") return "Game already finished.";
  if (state.turn !== slot) return "Not your turn.";

  const roll = rollDie();
  const from = state.positions[slot] ?? 0;
  const target = from + roll;
  state.rollId += 1;

  // House rule: you need an exact roll to land on 100. Overshooting stays put.
  if (target > 100) {
    state.lastEvent = { slot, roll, from, landed: from, to: from, kind: "blocked" };
    state.rollsLeft = roll === 6 ? 1 : 0;
    if (state.rollsLeft === 0) advanceTurn(state, playerCount);
    return null;
  }

  const hop = LADDERS[target] ?? SNAKES[target] ?? null;
  const final = hop ?? target;
  state.positions[slot] = final;

  const kind: LadderEvent["kind"] =
    final === 100
      ? "win"
      : LADDERS[target] !== undefined
        ? "ladder"
        : SNAKES[target] !== undefined
          ? "snake"
          : "move";

  state.lastEvent = { slot, roll, from, landed: target, to: final, kind };

  if (final === 100) {
    state.status = "over";
    state.winner = slot;
    state.rollsLeft = 0;
    return null;
  }

  // Classic house rule: a 6 earns another roll.
  state.rollsLeft = roll === 6 ? 1 : 0;
  if (state.rollsLeft === 0) advanceTurn(state, playerCount);
  return null;
}

function advanceTurn(state: SnakesLaddersState, playerCount: number) {
  const count = Math.max(playerCount, 1);
  state.turn = (state.turn + 1) % count;
  state.rollsLeft = 1;
}

/** Board squares ordered for a serpentine render, top row first. */
export function boardRows(): number[][] {
  const rows: number[][] = [];
  for (let row = 9; row >= 0; row--) {
    const start = row * 10 + 1;
    const cells = Array.from({ length: 10 }, (_, i) => start + i);
    rows.push(row % 2 === 0 ? cells : cells.reverse());
  }
  return rows;
}

/* ------------------------------- connect four ----------------------------- */

export const C4_COLS = 7;
export const C4_ROWS = 6;

export type Connect4State = {
  kind: "connect4";
  /** Row-major, top → bottom. Null = empty. */
  board: (Slot | null)[];
  turn: Slot;
  winner: Slot | "draw" | null;
  winningLine: number[] | null;
  lastDrop: number | null;
};

export function createConnect4(firstTurn: Slot = 0): Connect4State {
  return {
    kind: "connect4",
    board: Array(C4_COLS * C4_ROWS).fill(null),
    turn: firstTurn,
    winner: null,
    winningLine: null,
    lastDrop: null,
  };
}

function c4Index(row: number, col: number) {
  return row * C4_COLS + col;
}

function findC4Winner(board: (Slot | null)[]): {
  winner: Slot;
  line: number[];
} | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;
  for (let row = 0; row < C4_ROWS; row++) {
    for (let col = 0; col < C4_COLS; col++) {
      const start = board[c4Index(row, col)];
      if (start === null) continue;
      for (const [dr, dc] of dirs) {
        const line = [c4Index(row, col)];
        let r = row;
        let c = col;
        for (let step = 0; step < 3; step++) {
          r += dr;
          c += dc;
          if (r < 0 || r >= C4_ROWS || c < 0 || c >= C4_COLS) break;
          if (board[c4Index(r, c)] !== start) break;
          line.push(c4Index(r, c));
        }
        if (line.length === 4) return { winner: start, line };
      }
    }
  }
  return null;
}

export function applyConnect4Drop(
  state: Connect4State,
  slot: Slot,
  col: number,
): string | null {
  if (state.winner !== null) return "Game already finished.";
  if (slot !== state.turn) return "Not your turn.";
  if (col < 0 || col >= C4_COLS) return "Invalid column.";

  let dropRow = -1;
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    if (state.board[c4Index(row, col)] === null) {
      dropRow = row;
      break;
    }
  }
  if (dropRow < 0) return "Column is full.";

  const idx = c4Index(dropRow, col);
  state.board[idx] = slot;
  state.lastDrop = idx;

  const win = findC4Winner(state.board);
  if (win) {
    state.winner = win.winner;
    state.winningLine = win.line;
    return null;
  }
  if (state.board.every((cell) => cell !== null)) {
    state.winner = "draw";
    return null;
  }
  state.turn = slot === 0 ? 1 : 0;
  return null;
}

/* ----------------------------- rock paper scissors ------------------------ */

export type RpsChoice = "rock" | "paper" | "scissors";
export type RpsPick = RpsChoice | null | "locked";

export type RpsState = {
  kind: "rps";
  status: "lobby" | "playing" | "over";
  scores: number[];
  target: number;
  /** Real picks on the server. Public API may mask as "locked". */
  picks: RpsPick[];
  lastResult: {
    picks: (RpsChoice | null)[];
    winner: Slot | "draw";
  } | null;
  winner: Slot | null;
  roundId: number;
  /** Unused for simultaneous play; kept for shared turn UI helpers. */
  turn: Slot;
};

export const RPS_TARGET = 3;

export function createRps(playerCount = 2): RpsState {
  const n = Math.max(playerCount, 2);
  return {
    kind: "rps",
    status: "lobby",
    scores: Array(n).fill(0),
    target: RPS_TARGET,
    picks: Array(n).fill(null),
    lastResult: null,
    winner: null,
    roundId: 0,
    turn: 0,
  };
}

export function startRps(
  state: RpsState,
  playerCount: number,
  firstTurn = 0,
): string | null {
  if (playerCount < 2) return "Need at least 2 players.";
  state.status = "playing";
  state.scores = Array(playerCount).fill(0);
  state.picks = Array(playerCount).fill(null);
  state.lastResult = null;
  state.winner = null;
  state.roundId = 1;
  state.turn = firstTurn;
  return null;
}

function rpsBeats(a: RpsChoice, b: RpsChoice): Slot | "draw" {
  if (a === b) return "draw";
  if (
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper")
  ) {
    return 0;
  }
  return 1;
}

export function applyRpsPick(
  state: RpsState,
  slot: Slot,
  choice: RpsChoice,
  playerCount: number,
): string | null {
  if (state.status === "lobby") return "Waiting for the host to start.";
  if (state.status === "over" || state.winner !== null) {
    return "Game already finished.";
  }
  if (choice !== "rock" && choice !== "paper" && choice !== "scissors") {
    return "Invalid pick.";
  }
  if (state.picks[slot]) return "You already locked in.";

  state.picks[slot] = choice;

  if (state.picks.slice(0, playerCount).every(Boolean)) {
    const a = state.picks[0] as RpsChoice;
    const b = state.picks[1] as RpsChoice;
    const result = rpsBeats(a, b);
    state.lastResult = {
      picks: state.picks.map((p) => (p === "locked" ? null : p)),
      winner: result,
    };
    if (typeof result === "number") {
      state.scores[result] = (state.scores[result] ?? 0) + 1;
      if (state.scores[result] >= state.target) {
        state.winner = result;
        state.status = "over";
      }
    }
    state.picks = Array(playerCount).fill(null);
    state.roundId += 1;
  }
  return null;
}

/* --------------------------------- shared -------------------------------- */

export type GameState =
  | TicTacToeState
  | DiceState
  | SnakesLaddersState
  | Connect4State
  | RpsState;

export type RoomReaction = {
  id: string;
  playerId: string;
  name: string;
  slot: Slot;
  avatar: string;
  text: string;
  at: number;
};

export type RoomChat = {
  id: string;
  playerId: string;
  name: string;
  slot: Slot;
  avatar: string;
  text: string;
  at: number;
};

export const REACTION_OPTIONS = [
  "😂",
  "🔥",
  "😮",
  "❤️",
  "👏",
  "💀",
  "😭",
  "🤬",
] as const;

export type ReactionText = (typeof REACTION_OPTIONS)[number];

export function isReactionText(value: unknown): value is ReactionText {
  return (
    typeof value === "string" &&
    (REACTION_OPTIONS as readonly string[]).includes(value)
  );
}

export type Room = {
  code: string;
  gameType: GameType;
  players: Player[];
  state: GameState;
  wins: number[];
  round: number;
  reactions: RoomReaction[];
  chats: RoomChat[];
  updatedAt: number;
  createdAt: number;
};

const REACTION_TTL_MS = 7000;
const REACTION_MAX = 24;
const CHAT_MAX = 40;

export function pruneReactions(room: Room, now = Date.now()) {
  room.reactions = (room.reactions ?? [])
    .filter((r) => now - r.at < REACTION_TTL_MS)
    .slice(-REACTION_MAX);
}

export function pruneChats(room: Room) {
  room.chats = (room.chats ?? []).slice(-CHAT_MAX);
}

export function addReaction(
  room: Room,
  player: Player,
  text: ReactionText,
): RoomReaction {
  pruneReactions(room);
  const reaction: RoomReaction = {
    id: generatePlayerId(),
    name: player.name,
    playerId: player.id,
    slot: player.slot,
    avatar: player.avatar || "luffy",
    text,
    at: Date.now(),
  };
  room.reactions.push(reaction);
  pruneReactions(room);
  return reaction;
}

export function addChat(
  room: Room,
  player: Player,
  text: string,
): RoomChat | string {
  const cleaned = text.trim().slice(0, 140);
  if (!cleaned) return "Say something.";
  pruneChats(room);
  const newest = [...(room.chats ?? [])]
    .reverse()
    .find((c) => c.playerId === player.id);
  if (newest && Date.now() - newest.at < 400) {
    return "Slow down a bit.";
  }
  const chat: RoomChat = {
    id: generatePlayerId(),
    playerId: player.id,
    name: player.name,
    slot: player.slot,
    avatar: player.avatar || "luffy",
    text: cleaned,
    at: Date.now(),
  };
  room.chats.push(chat);
  pruneChats(room);
  return chat;
}

export function createState(
  gameType: GameType,
  firstTurn: Slot = 0,
  playerCount = 1,
): GameState {
  if (gameType === "dice") return createDice(playerCount);
  if (gameType === "snakesladders") return createSnakesLadders(playerCount);
  if (gameType === "connect4") return createConnect4(firstTurn);
  if (gameType === "rps") return createRps(Math.max(playerCount, 2));
  return createTicTacToe(firstTurn);
}

export function stateWinner(state: GameState): Slot | "draw" | null {
  return state.winner;
}

export function isFinished(state: GameState): boolean {
  return stateWinner(state) !== null;
}

/** Records a round win. Safe to call once per unfinished → finished transition. */
export function tallyWin(room: Room) {
  const winner = stateWinner(room.state);
  if (typeof winner !== "number") return;
  room.wins[winner] = (room.wins[winner] ?? 0) + 1;
}

export function publicRoom(room: Room, viewerId?: string) {
  pruneReactions(room);
  let state: GameState = room.state;

  // Mask RPS opponent picks until both players have locked in.
  if (state.kind === "rps" && state.status === "playing" && state.winner === null) {
    const viewer = room.players.find((p) => p.id === viewerId);
    const bothLocked = state.picks.every((p) => p !== null && p !== "locked");
    if (!bothLocked) {
      state = {
        ...state,
        picks: state.picks.map((pick, slot) => {
          if (!pick || pick === "locked") return pick;
          if (viewer && slot === viewer.slot) return pick;
          return "locked";
        }),
      };
    }
  }

  return {
    code: room.code,
    gameType: room.gameType,
    maxPlayers: MAX_PLAYERS[room.gameType],
    players: room.players.map(({ id, name, slot, avatar }) => ({
      id,
      name,
      slot,
      avatar: avatar || "luffy",
    })),
    state,
    wins: room.wins,
    round: room.round,
    reactions: room.reactions ?? [],
    chats: room.chats ?? [],
    updatedAt: room.updatedAt,
    createdAt: room.createdAt,
  };
}

export type PublicRoom = ReturnType<typeof publicRoom>;
