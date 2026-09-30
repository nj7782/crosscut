import { NextResponse } from "next/server";
import { addChat, publicRoom } from "@/lib/game";
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

  if (!body.playerId || typeof body.text !== "string") {
    return NextResponse.json({ error: "Say something." }, { status: 400 });
  }

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

  const baseUpdatedAt = room.updatedAt;
  const result = addChat(room, player, body.text);
  if (typeof result === "string") {
    return NextResponse.json({ error: result }, { status: 400 });
  }

  await writeRoom(room, baseUpdatedAt);
  return NextResponse.json({ room: publicRoom(room, body.playerId) });
}
