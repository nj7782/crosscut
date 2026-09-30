import { NextResponse } from "next/server";
import {
  MIN_PLAYERS,
  applyConnect4Drop,
  applyDiceAction,
  applyRpsPick,
  applySnakesLaddersRoll,
  applyTicTacToeMove,
  isFinished,
  publicRoom,
  startDice,
  startRps,
  startSnakesLadders,
  tallyWin,
  type Player,
  type RpsChoice,
  type Room,
} from "@/lib/game";
import { RoomConflictError, getRoom, writeRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

type Body = {
  playerId?: string;
  type?: string;
  index?: number;
  col?: number;
  choice?: string;
  expectedTurn?: number;
  /** Client pot before this roll/bank — blocks stale overwrites. */
  expectedPot?: number;
  expectedUpdatedAt?: number;
};

const STALE_HINTS = new Set([
  "Not your turn.",
  "Square already taken.",
  "Waiting for the host to start.",
  "POT_MISMATCH",
]);

function applyAction(room: Room, player: Player, body: Body): string | null {
  if (room.state.kind === "tictactoe") {
    return body.type === "move"
      ? applyTicTacToeMove(room.state, player.slot, body.index ?? -1)
      : "Unsupported action.";
  }

  if (room.state.kind === "connect4") {
    return body.type === "drop"
      ? applyConnect4Drop(room.state, player.slot, body.col ?? -1)
      : "Unsupported action.";
  }

  if (room.state.kind === "rps") {
    if (body.type === "start") {
      return player.slot === 0
        ? startRps(room.state, room.players.length)
        : "Only the host can start the game.";
    }
    if (body.type === "pick") {
      return applyRpsPick(
        room.state,
        player.slot,
        body.choice as RpsChoice,
        room.players.length,
      );
    }
    return "Unsupported action.";
  }

  if (room.state.kind === "dice") {
    if (body.type === "start") {
      return player.slot === 0
        ? startDice(room.state, room.players.length, 0)
        : "Only the host can start the game.";
    }
    if (body.type === "roll" || body.type === "bank") {
      if (
        typeof body.expectedPot === "number" &&
        room.state.pot !== body.expectedPot
      ) {
        return "POT_MISMATCH";
      }
      return applyDiceAction(
        room.state,
        player.slot,
        body.type,
        room.players.length,
      );
    }
    return "Unsupported action.";
  }

  if (room.state.kind === "snakesladders") {
    if (body.type === "start") {
      return player.slot === 0
        ? startSnakesLadders(room.state, room.players.length, 0)
        : "Only the host can start the game.";
    }
    if (body.type === "roll") {
      return applySnakesLaddersRoll(
        room.state,
        player.slot,
        room.players.length,
      );
    }
  }

  return "Unsupported action.";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Body;

  if (!body.playerId) {
    return NextResponse.json({ error: "Missing player." }, { status: 400 });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const room = await getRoom(code);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }
    if (!Array.isArray(room.reactions)) room.reactions = [];
    if (!Array.isArray(room.chats)) room.chats = [];

    const player = room.players.find((p) => p.id === body.playerId);
    if (!player) {
      return NextResponse.json(
        { error: "You are not in this room." },
        { status: 403 },
      );
    }

    if (room.players.length < MIN_PLAYERS[room.gameType]) {
      return NextResponse.json({ error: "Waiting for players." }, { status: 400 });
    }

    // Prefer the version the client actually saw when provided.
    if (
      typeof body.expectedUpdatedAt === "number" &&
      room.updatedAt < body.expectedUpdatedAt &&
      attempt < 4
    ) {
      await new Promise((r) => setTimeout(r, 200 + attempt * 200));
      continue;
    }

    const baseUpdatedAt = room.updatedAt;
    const wasFinished = isFinished(room.state);
    const failure = applyAction(room, player, body);

    if (failure) {
      if (STALE_HINTS.has(failure) && attempt < 4) {
        await new Promise((r) => setTimeout(r, 200 + attempt * 250));
        continue;
      }
      const message =
        failure === "POT_MISMATCH"
          ? "Pot changed — try again."
          : failure;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!wasFinished && isFinished(room.state)) tallyWin(room);

    try {
      await writeRoom(room, baseUpdatedAt);
      return NextResponse.json({
        room: publicRoom(room, body.playerId),
      });
    } catch (err) {
      if (err instanceof RoomConflictError && attempt < 4) {
        await new Promise((r) => setTimeout(r, 150 + attempt * 200));
        continue;
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: "Could not sync that roll. Try once more." },
    { status: 409 },
  );
}
