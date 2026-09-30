import { NextResponse } from "next/server";
import {
  createState,
  isFinished,
  publicRoom,
  startDice,
  startRps,
  startSnakesLadders,
} from "@/lib/game";
import { getRoom, writeRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    playerId?: string;
  } | null;

  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  if (!body?.playerId || !room.players.some((p) => p.id === body.playerId)) {
    return NextResponse.json({ error: "You are not in this room." }, { status: 403 });
  }

  if (!isFinished(room.state)) {
    return NextResponse.json({ error: "Round is still in progress." }, { status: 400 });
  }

  // Rotate who opens the next round so nobody keeps the first-move advantage.
  const baseUpdatedAt = room.updatedAt;
  const count = Math.max(room.players.length, 1);
  const firstTurn = room.round % count;
  room.round += 1;
  room.state = createState(room.gameType, firstTurn, count);

  if (room.state.kind === "snakesladders") {
    startSnakesLadders(room.state, count, firstTurn);
  }
  if (room.state.kind === "dice") {
    startDice(room.state, count, firstTurn);
  }
  if (room.state.kind === "rps") {
    startRps(room.state, count, firstTurn);
  }

  await writeRoom(room, baseUpdatedAt);
  return NextResponse.json({ room: publicRoom(room, body.playerId) });
}
