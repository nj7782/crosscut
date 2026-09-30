import { NextResponse } from "next/server";
import { DEFAULT_AVATAR, isAvatarId } from "@/lib/avatars";
import {
  createState,
  generateCode,
  generatePlayerId,
  isGameType,
  publicRoom,
  type Room,
} from "@/lib/game";
import { getRoom, writeRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

async function uniqueCode() {
  for (let i = 0; i < 8; i++) {
    const code = generateCode();
    const existing = await getRoom(code);
    if (!existing) return code;
  }
  return generateCode() + generateCode().slice(0, 2);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    gameType?: string;
    avatar?: string;
  } | null;

  const name = body?.name?.trim();
  if (!name || name.length > 20) {
    return NextResponse.json(
      { error: "Enter a name (max 20 characters)." },
      { status: 400 },
    );
  }

  const gameType = body?.gameType;
  if (!isGameType(gameType)) {
    return NextResponse.json({ error: "Pick a game first." }, { status: 400 });
  }

  const avatar = isAvatarId(body?.avatar) ? body.avatar : DEFAULT_AVATAR;
  const code = await uniqueCode();
  const playerId = generatePlayerId();
  const now = Date.now();

  const room: Room = {
    code,
    gameType,
    players: [{ id: playerId, name, slot: 0, avatar }],
    state: createState(gameType, 0, 1),
    wins: [0],
    round: 1,
    reactions: [],
    chats: [],
    updatedAt: now,
    createdAt: now,
  };

  await writeRoom(room);

  return NextResponse.json({ room: publicRoom(room, playerId), playerId });
}
