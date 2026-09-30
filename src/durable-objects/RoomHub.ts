import { DurableObject } from "cloudflare:workers";
import { publicRoom, type PublicRoom, type Room } from "../lib/game";

type SocketMeta = { playerId?: string };

export type RoomHubEnv = {
  ROOM_HUB: DurableObjectNamespace<RoomHub>;
  ROOMS?: KVNamespace;
};

/**
 * One instance per room code. Authoritative room state + hibernatable WebSockets.
 */
export class RoomHub extends DurableObject<RoomHubEnv> {
  private room: Room | null = null;
  private loaded = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    const stored = await this.ctx.storage.get<Room>("room");
    if (stored) {
      if (!Array.isArray(stored.reactions)) stored.reactions = [];
      if (!Array.isArray((stored as Room & { chats?: unknown }).chats)) {
        (stored as Room).chats = [];
      }
      this.room = stored;
    }
    this.loaded = true;
  }

  private async persist(room: Room) {
    this.room = room;
    await this.ctx.storage.put("room", room);
    // Best-effort KV mirror for cold recovery / tooling.
    try {
      await this.env.ROOMS?.put(
        `rooms/${room.code.toUpperCase()}.json`,
        JSON.stringify(room),
      );
    } catch {
      /* ignore KV mirror failures */
    }
  }

  private broadcast() {
    if (!this.room) return;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const meta = (ws.deserializeAttachment() ?? {}) as SocketMeta;
        const payload = {
          type: "room" as const,
          room: publicRoom(this.room, meta.playerId),
        };
        ws.send(JSON.stringify(payload));
      } catch {
        /* drop broken sockets */
      }
    }
  }

  /** RPC: read authoritative room. */
  async getRoom(): Promise<Room | null> {
    await this.ensureLoaded();
    return this.room ? structuredClone(this.room) : null;
  }

  /**
   * RPC: write room. Returns conflict if base is stale.
   * Broadcasts to all WebSocket subscribers on success.
   */
  async putRoom(
    room: Room,
    baseUpdatedAt: number,
  ): Promise<
    | { ok: true; room: Room }
    | { ok: false; conflict: true; room: Room }
  > {
    await this.ensureLoaded();
    if (!Array.isArray(room.reactions)) room.reactions = [];
    if (!Array.isArray(room.chats)) room.chats = [];

    if (this.room && this.room.updatedAt > baseUpdatedAt) {
      return { ok: false, conflict: true, room: structuredClone(this.room) };
    }

    room.updatedAt = Math.max(
      Date.now(),
      (this.room?.updatedAt ?? 0) + 1,
      baseUpdatedAt + 1,
    );
    await this.persist(room);
    this.broadcast();
    return { ok: true, room: structuredClone(room) };
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const playerId = url.searchParams.get("playerId") ?? undefined;
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ playerId } satisfies SocketMeta);

      if (this.room) {
        try {
          server.send(
            JSON.stringify({
              type: "room",
              room: publicRoom(this.room, playerId),
            }),
          );
        } catch {
          /* ignore */
        }
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith("/snapshot") && request.method === "GET") {
      const viewerId = url.searchParams.get("playerId") ?? undefined;
      if (!this.room) {
        return Response.json({ room: null }, { status: 404 });
      }
      return Response.json({ room: publicRoom(this.room, viewerId) });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ensureLoaded();
    if (typeof message !== "string") return;
    let data: { type?: string; playerId?: string } = {};
    try {
      data = JSON.parse(message) as { type?: string; playerId?: string };
    } catch {
      return;
    }
    if (data.type === "hello" && data.playerId) {
      ws.serializeAttachment({ playerId: data.playerId } satisfies SocketMeta);
      if (this.room) {
        ws.send(
          JSON.stringify({
            type: "room",
            room: publicRoom(this.room, data.playerId),
          }),
        );
      }
    }
    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
  }
}

export type { PublicRoom };
