import type { Room } from "./game";

const memory = new Map<string, Room>();

function pathFor(code: string) {
  return `rooms/${code.toUpperCase()}.json`;
}

function normalize(room: Room): Room {
  if (!Array.isArray(room.reactions)) room.reactions = [];
  if (!Array.isArray(room.chats)) room.chats = [];
  for (const p of room.players) {
    if (!p.avatar) p.avatar = "luffy";
  }
  return room;
}

type RoomsKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

type PutResult =
  | { ok: true; room: Room }
  | { ok: false; conflict: true; room: Room };

type RoomHubRpc = {
  getRoom(): Promise<Room | null>;
  putRoom(room: Room, baseUpdatedAt: number): Promise<PutResult>;
};

type EnvWithHub = {
  ROOMS?: RoomsKv;
  ROOM_HUB?: DurableObjectNamespace;
};

async function getEnv(): Promise<EnvWithHub | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx?.env as EnvWithHub | undefined) ?? null;
  } catch {
    return null;
  }
}

async function getHub(code: string): Promise<RoomHubRpc | null> {
  const env = await getEnv();
  const ns = env?.ROOM_HUB;
  if (!ns) return null;
  return ns.get(ns.idFromName(code.toUpperCase())) as unknown as RoomHubRpc;
}

async function peekKvRoom(key: string): Promise<Room | null> {
  const env = await getEnv();
  const kv = env?.ROOMS;
  if (!kv) return null;
  try {
    const raw = await kv.get(pathFor(key));
    if (!raw) return null;
    return normalize(JSON.parse(raw) as Room);
  } catch {
    return null;
  }
}

export class RoomConflictError extends Error {
  constructor() {
    super("ROOM_CONFLICT");
    this.name = "RoomConflictError";
  }
}

/**
 * Persist room. Prefer Durable Object (broadcasts to WebSocket clients).
 * Falls back to KV/memory for local next dev without bindings.
 */
export async function writeRoom(
  room: Room,
  baseUpdatedAt?: number,
): Promise<void> {
  normalize(room);
  const key = room.code.toUpperCase();
  const base = baseUpdatedAt ?? room.updatedAt;

  const hub = await getHub(key);
  if (hub) {
    // Seed DO from KV if empty (migration / first touch after deploy).
    const existing = await hub.getRoom();
    if (!existing) {
      const fromKv = await peekKvRoom(key);
      if (fromKv && fromKv.updatedAt > base) {
        memory.set(key, structuredClone(fromKv));
        throw new RoomConflictError();
      }
      if (fromKv && (!room.updatedAt || room.updatedAt < fromKv.updatedAt)) {
        // Rare: caller holds older than KV — conflict.
      }
    }

    const result = await hub.putRoom(room, base);
    if (!result.ok) {
      memory.set(key, structuredClone(result.room));
      throw new RoomConflictError();
    }
    memory.set(key, structuredClone(result.room));
    // Mirror updatedAt onto caller object so API responses stay correct.
    room.updatedAt = result.room.updatedAt;
    room.chats = result.room.chats;
    room.reactions = result.room.reactions;
    return;
  }

  const env = await getEnv();
  const kv = env?.ROOMS;

  if (kv) {
    const latest = await peekKvRoom(key);
    if (latest && latest.updatedAt > base) {
      memory.set(key, structuredClone(latest));
      throw new RoomConflictError();
    }
  }

  const previous = memory.get(key);
  room.updatedAt = Math.max(
    Date.now(),
    (previous?.updatedAt ?? 0) + 1,
    base + 1,
  );
  memory.set(key, structuredClone(room));

  if (!kv) return;
  await kv.put(pathFor(key), JSON.stringify(room));
}

export async function getRoom(code: string): Promise<Room | null> {
  const key = code.toUpperCase();

  const hub = await getHub(key);
  if (hub) {
    let room = await hub.getRoom();
    if (!room) {
      const fromKv = await peekKvRoom(key);
      if (fromKv) {
        // Hydrate DO from KV once.
        const seeded = await hub.putRoom(fromKv, fromKv.updatedAt - 1);
        if (seeded.ok) room = seeded.room;
        else room = seeded.room;
      }
    }
    if (!room) {
      const cached = memory.get(key);
      return cached ? structuredClone(cached) : null;
    }
    normalize(room);
    memory.set(key, structuredClone(room));
    return structuredClone(room);
  }

  const cached = memory.get(key);
  const env = await getEnv();
  const kv = env?.ROOMS;

  if (!kv) {
    return cached ? structuredClone(cached) : null;
  }

  try {
    const stored = await peekKvRoom(key);
    if (!stored) {
      return cached ? structuredClone(cached) : null;
    }

    const room =
      cached && cached.updatedAt > stored.updatedAt ? cached : stored;

    if (cached !== room) memory.set(key, room);
    return structuredClone(normalize(room));
  } catch {
    return cached ? structuredClone(cached) : null;
  }
}
