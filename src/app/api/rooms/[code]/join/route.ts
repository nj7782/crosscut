import { NextResponse } from "next/server";
import { DEFAULT_AVATAR, isAvatarId } from "@/lib/avatars";
import { MAX_PLAYERS, generatePlayerId, publicRoom } from "@/lib/game";
import { getRoom, writeRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    playerId?: string;
    avatar?: string;
  } | null;

  const name = body?.name?.trim();
  if (!name || name.length > 20) {
    return NextResponse.json(
      { error: "Enter a name (max 20 characters)." },
      { status: 400 },
    );
  }

  const avatar = isAvatarId(body?.avatar) ? body.avatar : DEFAULT_AVATAR;

  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Reconnect an existing player instead of handing them a second seat.
  if (body?.playerId) {
    const existing = room.players.find((p) => p.id === body.playerId);
    if (existing) {
      const baseUpdatedAt = room.updatedAt;
      existing.name = name;
      existing.avatar = avatar;
      await writeRoom(room, baseUpdatedAt);
      return NextResponse.json({
        room: publicRoom(room, existing.id),
        playerId: existing.id,
      });
    }
  }

  const max = MAX_PLAYERS[room.gameType];
  if (room.players.length >= max) {
    return NextResponse.json(
      { error: `This room is full (${max} players).` },
      { status: 409 },
    );
  }

  if (
    (room.state.kind === "snakesladders" ||
      room.state.kind === "dice" ||
      room.state.kind === "rps") &&
    room.state.status !== "lobby"
  ) {
    return NextResponse.json(
      { error: "That game already started." },
      { status: 409 },
    );
  }

  if (
    (room.state.kind === "tictactoe" || room.state.kind === "connect4") &&
    room.state.winner === null &&
    room.players.length >= 2 &&
    room.state.board.some((cell) => cell !== null)
  ) {
    return NextResponse.json(
      { error: "That game already started." },
      { status: 409 },
    );
  }

  const playerId = generatePlayerId();
  const slot = room.players.length;
  room.players.push({ id: playerId, name, slot, avatar });
  room.wins[slot] = room.wins[slot] ?? 0;

  if (room.state.kind === "snakesladders") {
    room.state.positions[slot] = 0;
  }
  if (room.state.kind === "dice") {
    room.state.scores[slot] = 0;
  }

  const baseUpdatedAt = room.updatedAt;
  await writeRoom(room, baseUpdatedAt);

  return NextResponse.json({ room: publicRoom(room, playerId), playerId });
}
