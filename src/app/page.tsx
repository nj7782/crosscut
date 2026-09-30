"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import ConnectFour from "@/components/ConnectFour";
import DiceDuel from "@/components/DiceDuel";
import AvatarFace from "@/components/AvatarFace";
import AvatarPicker from "@/components/AvatarPicker";
import PostGameScreen from "@/components/PostGameScreen";
import ReactionBar from "@/components/ReactionBar";
import RpsDuel from "@/components/RpsDuel";
import SnakesLadders from "@/components/SnakesLadders";
import SoundToggle from "@/components/SoundToggle";
import TicTacToe from "@/components/TicTacToe";
import {
  MAX_PLAYERS,
  isFinished,
  type GameType,
  type PublicRoom,
  type ReactionText,
  type RpsChoice,
} from "@/lib/game";
import { DEFAULT_AVATAR, isAvatarId, type AvatarId } from "@/lib/avatars";
import { sfx, unlockAudio } from "@/lib/sfx";
import { GAME_META, GAME_ORDER } from "@/lib/theme";

type Session = { code: string; playerId: string; name: string; avatar?: string };

type ApiPayload = {
  error?: string;
  room?: PublicRoom;
  playerId?: string;
};

async function readApi(res: Response): Promise<ApiPayload> {
  return (await res.json()) as ApiPayload;
}

const STORAGE_KEY = "crosscut-session";
const LOBBY_THEME_KEY = "crosscut-lobby-theme";
type LobbyTheme = "light" | "dark";

function loadLobbyTheme(): LobbyTheme {
  try {
    if (typeof window === "undefined") return "dark";
    const raw = localStorage.getItem(LOBBY_THEME_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    /* ignore */
  }
  return "dark";
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export default function Home() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR);
  const [gameType, setGameType] = useState<GameType>("snakesladders");
  const [joinCode, setJoinCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [booted, setBooted] = useState(false);
  const [lobbyTheme, setLobbyTheme] = useState<LobbyTheme>(loadLobbyTheme);
  const winChime = useRef<string | null>(null);

  const me = room?.players.find((p) => p.id === session?.playerId) ?? null;
  const seenUpdatedAt = useRef(0);
  const roomRef = useRef(room);
  roomRef.current = room;

  const applyRoom = useCallback((next: PublicRoom) => {
    seenUpdatedAt.current = Math.max(seenUpdatedAt.current, next.updatedAt);
    setRoom(next);
  }, []);

  const ingestRoom = useCallback((next: PublicRoom) => {
    setRoom((prev) => {
      if (!prev) {
        seenUpdatedAt.current = next.updatedAt;
        return next;
      }
      if (next.updatedAt < prev.updatedAt) return prev;
      if (next.updatedAt === prev.updatedAt) {
        const chatGain = (next.chats?.length ?? 0) > (prev.chats?.length ?? 0);
        const reactGain =
          (next.reactions?.length ?? 0) > (prev.reactions?.length ?? 0);
        if (!chatGain && !reactGain) return prev;
      }
      seenUpdatedAt.current = Math.max(seenUpdatedAt.current, next.updatedAt);
      return next;
    });
  }, []);

  const refresh = useCallback(
    async (code: string, playerId?: string) => {
      const qs = new URLSearchParams();
      if (playerId) qs.set("playerId", playerId);
      if (seenUpdatedAt.current > 0) {
        qs.set("since", String(seenUpdatedAt.current));
      }
      const query = qs.toString();
      const res = await fetch(`/api/rooms/${code}${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      if (res.status === 204) return;
      if (!res.ok) {
        if (res.status === 404) {
          setError("That room expired.");
          setSession(null);
          setRoom(null);
          saveSession(null);
        }
        return;
      }
      const data = (await res.json()) as { room: PublicRoom };
      ingestRoom(data.room);
    },
    [ingestRoom],
  );

  const wsLive = useRef(false);

  useEffect(() => {
    if (!session?.code || !session.playerId) return;
    let closed = false;
    let ws: WebSocket | null = null;
    let retry = 0;
    let retryTimer = 0;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${proto}://${window.location.host}/api/rooms/${encodeURIComponent(session.code)}/ws?playerId=${encodeURIComponent(session.playerId)}`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        wsLive.current = true;
        retry = 0;
        ws?.send(
          JSON.stringify({ type: "hello", playerId: session.playerId }),
        );
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as {
            type?: string;
            room?: PublicRoom;
          };
          if (data.type === "room" && data.room) ingestRoom(data.room);
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        wsLive.current = false;
        if (closed) return;
        const delay = Math.min(4000, 400 + retry * 500);
        retry += 1;
        retryTimer = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();
    return () => {
      closed = true;
      wsLive.current = false;
      window.clearTimeout(retryTimer);
      ws?.close();
    };
  }, [session?.code, session?.playerId, ingestRoom]);

  useEffect(() => {
    async function boot() {
      const existing = loadSession();
      if (existing?.code && existing.playerId) {
        try {
          const res = await fetch(
            `/api/rooms/${existing.code}?playerId=${encodeURIComponent(existing.playerId)}`,
            {
              cache: "no-store",
            },
          );
          if (!res.ok) {
            saveSession(null);
          } else {
            const data = (await res.json()) as { room: PublicRoom };
            const stillIn = data.room.players.some(
              (p) => p.id === existing.playerId,
            );
            if (!stillIn || !data.room.state?.kind) {
              saveSession(null);
            } else {
              setSession(existing);
              setName(existing.name);
              const mine = data.room.players.find((p) => p.id === existing.playerId);
              if (isAvatarId(mine?.avatar)) setAvatar(mine.avatar);
              else if (isAvatarId(existing.avatar)) setAvatar(existing.avatar);
              seenUpdatedAt.current = data.room.updatedAt;
              setRoom(data.room);
            }
          }
        } catch {
          saveSession(null);
        }
      }
      setBooted(true);
    }
    void boot();
  }, []);

  useEffect(() => {
    const unlock = () => {
      void unlockAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!room) return;
    const state = room.state;
    let key: string | null = null;
    if (state.kind === "tictactoe" && state.winner !== null) {
      key = `${room.code}-ttt-${String(state.winner)}-${room.wins[typeof state.winner === "number" ? state.winner : 0] ?? 0}`;
    } else if (state.kind === "connect4" && state.winner !== null) {
      key = `${room.code}-c4-${String(state.winner)}-${room.wins[typeof state.winner === "number" ? state.winner : 0] ?? 0}`;
    } else if (state.kind === "rps" && state.winner !== null) {
      key = `${room.code}-rps-${state.winner}-${room.wins[state.winner] ?? 0}`;
    } else if (state.kind === "dice" && state.winner !== null) {
      key = `${room.code}-dice-${state.winner}-${room.wins[state.winner] ?? 0}`;
    } else if (state.kind === "snakesladders" && state.status === "over") {
      key = `${room.code}-sl-${state.winner ?? "x"}-${state.winner !== null ? room.wins[state.winner] ?? 0 : 0}`;
    }
    if (!key || winChime.current === key) return;
    winChime.current = key;
    sfx.win();
  }, [room]);

  useEffect(() => {
    if (!session?.code) return;
    let alive = true;
    let timer = 0;

    const delayFor = () => {
      if (typeof document !== "undefined" && document.hidden) return 2500;
      // WebSocket connected → rare safety poll only.
      if (wsLive.current) return 4000;
      const current = roomRef.current;
      if (!current) return 400;
      if (isFinished(current.state)) return 1000;
      if (current.players.length < 2) return 600;
      // Fallback until WS is up — keep this snappy on desktop.
      return 150;
    };

    const tick = async () => {
      if (!alive) return;
      await refresh(session.code, session.playerId);
      if (!alive) return;
      timer = window.setTimeout(tick, delayFor());
    };

    const onVisibility = () => {
      if (!document.hidden) void refresh(session.code, session.playerId);
    };
    document.addEventListener("visibilitychange", onVisibility);

    timer = window.setTimeout(tick, 120);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session?.code, session?.playerId, refresh]);

  async function createRoom() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, gameType, avatar }),
      });
      const data = await readApi(res);
      if (!res.ok) throw new Error(data.error || "Could not create the room.");
      if (!data.room || !data.playerId) {
        throw new Error("Could not create the room.");
      }
      const next: Session = {
        code: data.room.code,
        playerId: data.playerId,
        name: name.trim(),
        avatar,
      };
      setSession(next);
      applyRoom(data.room);
      saveSession(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    setError(null);
    setBusy(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, playerId: session?.playerId, avatar }),
      });
      const data = await readApi(res);
      if (!res.ok) throw new Error(data.error || "Could not join that room.");
      if (!data.room || !data.playerId) {
        throw new Error("Could not join that room.");
      }
      const next: Session = {
        code: data.room.code,
        playerId: data.playerId,
        name: name.trim(),
        avatar,
      };
      setSession(next);
      applyRoom(data.room);
      saveSession(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function sendAction(type: string, extra?: Record<string, unknown>) {
    if (!session || !room) return;
    setError(null);
    setBusy(true);

    const expectedTurn =
      room.state.kind === "dice" ||
      room.state.kind === "snakesladders" ||
      room.state.kind === "tictactoe" ||
      room.state.kind === "connect4"
        ? room.state.turn
        : undefined;

    const expectedPot =
      room.state.kind === "dice" ? room.state.pot : undefined;

    const attempt = async () => {
      const res = await fetch(`/api/rooms/${session.code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          type,
          expectedTurn,
          expectedPot,
          expectedUpdatedAt: room.updatedAt,
          ...extra,
        }),
      });
      const data = await readApi(res);
      return { res, data };
    };

    try {
      let { res, data } = await attempt();

      // Stale room copies sometimes reject a valid turn — refresh and retry once.
      if (!res.ok && data.error === "Not your turn.") {
        await refresh(session.code, session.playerId);
        await new Promise((r) => setTimeout(r, 350));
        ({ res, data } = await attempt());
      }

      // RPS: first click already locked server-side — treat as success.
      if (!res.ok && data.error === "You already locked in.") {
        await refresh(session.code, session.playerId);
        setError(null);
        return;
      }

      if (!res.ok) throw new Error(data.error || "That move did not work.");
      if (!data.room) throw new Error("That move did not work.");
      applyRoom(data.room);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That move did not work.");
      void refresh(session.code, session.playerId);
    } finally {
      setBusy(false);
    }
  }

  async function sendReaction(text: ReactionText) {
    if (!session) return;
    try {
      const res = await fetch(`/api/rooms/${session.code}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: session.playerId, text }),
      });
      const data = await readApi(res);
      if (res.ok && data.room) {
        ingestRoom(data.room);
      }
    } catch {
      /* ignore reaction failures */
    }
  }

  async function sendChat(text: string) {
    if (!session) return;
    const res = await fetch(`/api/rooms/${session.code}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: session.playerId, text }),
    });
    const data = await readApi(res);
    if (!res.ok) throw new Error(data.error || "Could not send.");
    if (data.room) ingestRoom(data.room);
  }

  function playSquare(index: number) {
    if (!room || room.state.kind !== "tictactoe" || !me) return;
    // Paint the mark immediately; the server response replaces it moments later.
    const mark = me.slot === 0 ? "X" : "O";
    setRoom({
      ...room,
      state: {
        ...room.state,
        board: room.state.board.map((cell, i) => (i === index ? mark : cell)),
        turn: me.slot === 0 ? 1 : 0,
      },
    });
    void sendAction("move", { index });
  }

  function dropDisc(col: number) {
    if (!room || room.state.kind !== "connect4" || !me) return;
    const state = room.state;
    if (state.winner !== null || me.slot !== state.turn) return;
    if (col < 0 || col >= 7) return;

    let dropRow = -1;
    for (let row = 5; row >= 0; row--) {
      const idx = row * 7 + col;
      if (state.board[idx] === null) {
        dropRow = row;
        break;
      }
    }
    if (dropRow < 0) return;

    const idx = dropRow * 7 + col;
    const nextBoard = state.board.slice();
    nextBoard[idx] = me.slot;
    setRoom({
      ...room,
      state: {
        ...state,
        board: nextBoard,
        turn: me.slot === 0 ? 1 : 0,
        lastDrop: idx,
      },
    });
    void sendAction("drop", { col });
  }

  function rpsAction(type: "start" | "pick", extra?: { choice: RpsChoice }) {
    if (
      type === "pick" &&
      extra?.choice &&
      room?.state.kind === "rps" &&
      me
    ) {
      const state = room.state;
      if (!state.picks[me.slot]) {
        const picks = state.picks.slice();
        picks[me.slot] = extra.choice;
        setRoom({
          ...room,
          state: { ...state, picks },
        });
      }
    }
    void sendAction(type, extra);
  }

  async function rematch() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${session.code}/rematch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: session.playerId }),
      });
      const data = await readApi(res);
      if (!res.ok) throw new Error(data.error || "Could not restart.");
      if (!data.room) throw new Error("Could not restart.");
      applyRoom(data.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restart.");
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    setSession(null);
    setRoom(null);
    seenUpdatedAt.current = 0;
    setJoinCode("");
    setError(null);
    saveSession(null);
  }

  async function copyCode() {
    if (!room) return;
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  useEffect(() => {
    const mode = room && session ? "play" : "lobby";
    document.body.dataset.mode = mode;
    return () => {
      delete document.body.dataset.mode;
    };
  }, [room, session]);

  useLayoutEffect(() => {
    document.body.dataset.theme = lobbyTheme;
    document.body.dataset.lobbyTheme = lobbyTheme;
    document.documentElement.dataset.theme = lobbyTheme;
    try {
      localStorage.setItem(LOBBY_THEME_KEY, lobbyTheme);
    } catch {
      /* ignore */
    }
  }, [lobbyTheme]);

  const themeToggle = (
    <button
      type="button"
      className="lobby-theme-toggle"
      onClick={() => {
        sfx.click();
        setLobbyTheme((t) => (t === "light" ? "dark" : "light"));
      }}
      aria-pressed={lobbyTheme === "dark"}
      aria-label={
        lobbyTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      title={lobbyTheme === "dark" ? "Light mode" : "Dark mode"}
    >
      <span className="lobby-theme-thumb" aria-hidden="true">
        {lobbyTheme === "dark" ? (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle
              cx="8"
              cy="8"
              r="3.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M13.2 9.4A5.4 5.4 0 0 1 6.6 2.8 5.4 5.4 0 1 0 13.2 9.4Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {lobbyTheme === "dark" ? "Light" : "Dark"}
    </button>
  );

  if (!booted) {
    return (
      <main className="lobby-shell flex min-h-screen items-center justify-center">
        <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--pine)]">
          CrossCut
        </p>
      </main>
    );
  }

  if (room && session) {
    return (
      <main
        className={`play-shell mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10 ${
          lobbyTheme === "light" ? "play-shell-light" : ""
        }`}
      >
        <header className="animate-rise mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-dim">
              CrossCut · {GAME_META[room.gameType].title}
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <p className="font-[family-name:var(--font-mono)] text-3xl font-bold tracking-[0.22em] text-lime sm:text-4xl">
                {room.code}
              </p>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="btn-ghost rounded-lg px-2.5 py-1 text-xs font-semibold"
              >
                {copied ? "copied" : "copy"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {themeToggle}
            <SoundToggle />
            <div
              className="flex items-center gap-2"
              title={room.players.map((p) => p.name).join(", ") || "No players yet"}
            >
              <div className="flex items-center gap-1" aria-hidden="true">
                {room.players.map((p) => (
                  <AvatarFace key={p.id} id={p.avatar} size={22} title={p.name} />
                ))}
                {Array.from(
                  { length: Math.max(room.maxPlayers - room.players.length, 0) },
                  (_, i) => (
                    <span
                      key={`empty-${i}`}
                      className="inline-block h-[22px] w-[22px] rounded-full border border-dashed border-edge"
                    />
                  ),
                )}
              </div>
              <p className="font-mono text-xs text-dim">
                {room.players.length}/{room.maxPlayers} players joined
              </p>
            </div>
            <button
              type="button"
              onClick={leave}
              className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Leave
            </button>
          </div>
        </header>

        {room.state.kind === "snakesladders" ? (
          <SnakesLadders
            room={room}
            state={room.state}
            me={me}
            busy={busy}
            onAction={(type) => void sendAction(type)}
            copied={copied}
            onCopyCode={() => void copyCode()}
          />
        ) : room.state.kind === "tictactoe" ? (
          <TicTacToe
            room={room}
            state={room.state}
            me={me}
            busy={busy}
            onMove={playSquare}
            copied={copied}
            onCopyCode={() => void copyCode()}
          />
        ) : room.state.kind === "connect4" ? (
          <ConnectFour
            room={room}
            state={room.state}
            me={me}
            busy={busy}
            onDrop={dropDisc}
            copied={copied}
            onCopyCode={() => void copyCode()}
          />
        ) : room.state.kind === "rps" ? (
          <RpsDuel
            room={room}
            state={room.state}
            me={me}
            busy={busy}
            onAction={rpsAction}
            copied={copied}
            onCopyCode={() => void copyCode()}
          />
        ) : (
          <DiceDuel
            room={room}
            state={room.state}
            me={me}
            busy={busy}
            onAction={(type) => void sendAction(type)}
            copied={copied}
            onCopyCode={() => void copyCode()}
          />
        )}

        {isFinished(room.state) ? (
          <PostGameScreen
            room={room}
            me={me}
            busy={busy}
            onRematch={() => void rematch()}
            onLeave={leave}
          />
        ) : null}

        <ChatPanel
          room={room}
          myId={session.playerId}
          disabled={busy}
          onSend={sendChat}
        />

        <ReactionBar
          room={room}
          myId={session.playerId}
          myName={session.name}
          myAvatar={me?.avatar || session.avatar}
          disabled={busy}
          onReact={(text) => void sendReaction(text)}
        />

        {error ? (
          <p className="mx-auto mt-6 max-w-md rounded-xl border border-flare/40 bg-flare/10 px-4 py-2.5 text-center text-sm text-flare">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  return (
    <main className="lobby-shell">
      <div className="lobby-frame">
        <header className="lobby-nav animate-rise">
          <a href="/" className="lobby-brand" aria-label="CrossCut home">
            <span className="lobby-brand-name">
              <Image
                src="/crosscut-logo.png"
                alt=""
                width={36}
                height={36}
                className="lobby-brand-c"
                priority
              />
              <span>rossCut</span>
            </span>
          </a>
          <div className="lobby-nav-actions">
            {themeToggle}
            <SoundToggle />
            <a href="#seat" className="lobby-btn lobby-btn-pine">
              Create a room →
            </a>
          </div>
        </header>

        <section className="lobby-hero">
          <div className="lobby-hero-copy animate-rise" style={{ animationDelay: "40ms" }}>
            <p className="lobby-eyebrow">
              <span className="lobby-eyebrow-dot" aria-hidden="true" />
              The table for friends far away
            </p>
            <h1 className="lobby-headline">
              Same room energy.
              <span className="lobby-headline-accent"> Anywhere you are.</span>
            </h1>
            <p className="lobby-lead">
              Pick a game, share a room code, play together. No accounts, no
              installs — rematch until someone has to leave.
            </p>

            <div className="lobby-cta-row">
              <a href="#seat" className="lobby-btn lobby-btn-emerald">
                Create a room →
              </a>
              <a href="#seat-join" className="lobby-btn lobby-btn-outline">
                Join with a code
              </a>
            </div>

            <p className="lobby-meta">
              {GAME_ORDER.length} games · no accounts · share a code
            </p>
          </div>

          <div
            id="seat"
            className="lobby-seat-wrap animate-rise"
            style={{ animationDelay: "120ms" }}
          >
            <section className="lobby-seat" aria-label="Take a seat">
              <div className="lobby-seat-top">
                <p className="lobby-seat-kicker">Room lobby</p>
                <h2 className="lobby-seat-title">Take a seat</h2>
                <p className="lobby-seat-sub">
                  Playing {GAME_META[gameType].title} · up to{" "}
                  {MAX_PLAYERS[gameType]} players
                </p>
              </div>

              <div className="lobby-game-pills" role="listbox" aria-label="Choose a game">
                {GAME_ORDER.map((type) => {
                  const meta = GAME_META[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      role="option"
                      aria-selected={gameType === type}
                      data-selected={gameType === type}
                      onClick={() => {
                        sfx.click();
                        setGameType(type);
                      }}
                      className="lobby-game-pill"
                    >
                      {meta.title}
                    </button>
                  );
                })}
              </div>

              <label className="lobby-field-label">
                <span>Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  placeholder="Ada"
                  className="lobby-field"
                />
              </label>

              <div className="lobby-avatar-block">
                <AvatarPicker value={avatar} onChange={setAvatar} />
              </div>

              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={() => void createRoom()}
                className="lobby-btn lobby-btn-emerald lobby-btn-block"
              >
                Create a room →
              </button>

              <div id="seat-join" className="lobby-divider">
                <span>or join one</span>
              </div>

              <div className="lobby-join-row">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="CODE"
                  className="lobby-field lobby-field-code"
                  aria-label="Room code"
                />
                <button
                  type="button"
                  disabled={busy || !name.trim() || !joinCode.trim()}
                  onClick={() => void joinRoom()}
                  className="lobby-btn lobby-btn-outline lobby-btn-join"
                >
                  Join
                </button>
              </div>

              {error ? <p className="lobby-error">{error}</p> : null}

              <div className="lobby-seat-foot">
                <span>Ready when you are</span>
                <span className="lobby-live">
                  <span className="lobby-live-dot" aria-hidden="true" />
                  Live rooms
                </span>
              </div>
            </section>
          </div>
        </section>

        <section className="lobby-features" aria-label="How CrossCut works">
          <article className="lobby-feature">
            <p className="lobby-feature-kicker">01 / Pick</p>
            <h3 className="lobby-feature-title">Choose the table</h3>
            <p className="lobby-feature-body">
              Snakes & Ladders, Tic Tac Toe, Dice Duel, Connect Four, or RPS —
              same lobby, five games.
            </p>
          </article>
          <article className="lobby-feature">
            <p className="lobby-feature-kicker">02 / Share</p>
            <h3 className="lobby-feature-title">Send the room code</h3>
            <p className="lobby-feature-body">
              Friends join from any browser. No accounts, no installs, no
              downloads.
            </p>
          </article>
          <article className="lobby-feature">
            <p className="lobby-feature-kicker">03 / Play</p>
            <h3 className="lobby-feature-title">Rematch until bedtime</h3>
            <p className="lobby-feature-body">
              Chat, react, and keep the streak going until someone has to leave.
            </p>
          </article>
        </section>

        <footer className="lobby-footer">
          <p>CrossCut · Made by Jitin · No accounts</p>
          <p className="lobby-footer-status">
            <span className="lobby-live-dot" aria-hidden="true" />
            Ready to play
          </p>
        </footer>
      </div>
    </main>
  );
}
