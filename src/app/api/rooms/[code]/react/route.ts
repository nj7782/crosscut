import { NextResponse } from "next/server";
import {
  addReaction,
  isReactionText,
  publicRoom,
} from "@/lib/game";
import { getRoom, writeRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const body = ((await request.json().catch(() => null)) ?? {}) as {
    playerId?: string;
    text?: string;
  };

  if (!body.playerId || !isReactionText(body.text)) {
    return NextResponse.json({ error: "Pick a reaction." }, { status: 400 });
  }

  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  if (!Array.isArray(room.reactions)) room.reactions = [];
  if (!Array.isArray(room.chats)) room.chats = [];

  const player = room.players.find((p) => p.id === body.playerId);
  if (!player) {
    return NextResponse.json({ error: "You are not in this room." }, { status: 403 });
  }

  // Light rate limit: same player can't spam faster than ~700ms.
  const newest = [...room.reactions].reverse().find((r) => r.playerId === player.id);
  if (newest && Date.now() - newest.at < 700) {
    return NextResponse.json({ room: publicRoom(room, body.playerId) });
  }

  const baseUpdatedAt = room.updatedAt;
  addReaction(room, player, body.text);
  await writeRoom(room, baseUpdatedAt);
  return NextResponse.json({ room: publicRoom(room, body.playerId) });
}
