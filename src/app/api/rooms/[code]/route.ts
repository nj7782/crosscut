import { NextResponse } from "next/server";
import { publicRoom } from "@/lib/game";
import { getRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const url = new URL(request.url);
  const viewerId = url.searchParams.get("playerId") ?? undefined;
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw ? Number(sinceRaw) : 0;

  const room = await getRoom(code);

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Cheap poll: client already has this version — skip JSON + publicRoom work.
  if (Number.isFinite(since) && since > 0 && room.updatedAt <= since) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "X-Room-Updated-At": String(room.updatedAt),
      },
    });
  }

  return NextResponse.json(
    { room: publicRoom(room, viewerId) },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Room-Updated-At": String(room.updatedAt),
      },
    },
  );
}
