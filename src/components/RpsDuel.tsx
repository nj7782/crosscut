"use client";

import { useEffect, useRef } from "react";
import type { PublicRoom, RpsChoice, RpsState } from "@/lib/game";
import { colorFor } from "@/lib/theme";
import { sfx } from "@/lib/sfx";
import AvatarFace from "./AvatarFace";
import ShareInvite from "./ShareInvite";

type Me = { id: string; name: string; slot: number } | null;

const CHOICES: { id: RpsChoice; label: string; glyph: string }[] = [
  { id: "rock", label: "Rock", glyph: "✊" },
  { id: "paper", label: "Paper", glyph: "✋" },
  { id: "scissors", label: "Scissors", glyph: "✌️" },
];

function glyphFor(pick: RpsChoice | null | "locked" | undefined) {
  if (!pick || pick === "locked") return "❔";
  return CHOICES.find((c) => c.id === pick)?.glyph ?? "❔";
}

export default function RpsDuel({
  room,
  state,
  me,
  busy,
  onAction,
  copied,
  onCopyCode,
}: {
  room: PublicRoom;
  state: RpsState;
  me: Me;
  busy: boolean;
  onAction: (type: "start" | "pick", extra?: { choice: RpsChoice }) => void;
  copied: boolean;
  onCopyCode: () => void;
}) {
  const isHost = me?.slot === 0;
  const waiting = room.players.length < 2;
  const playing = state.status === "playing";
  const over = state.status === "over" || state.winner !== null;
  const myPick = me ? state.picks[me.slot] : null;
  const lockedIn = Boolean(myPick && myPick !== "locked");
  const heardRound = useRef(state.roundId);

  useEffect(() => {
    if (state.roundId === heardRound.current) return;
    // New round after a reveal (or start) — chirp on result.
    if (state.lastResult && state.roundId > heardRound.current) {
      if (state.lastResult.winner === "draw") sfx.click();
      else if (state.lastResult.winner === me?.slot) sfx.place();
      else sfx.bust();
    }
    heardRound.current = state.roundId;
  }, [state.roundId, state.lastResult, me?.slot]);

  const resultLine = (() => {
    if (!state.lastResult) return null;
    const [a, b] = state.lastResult.picks;
    const p0 = room.players.find((p) => p.slot === 0);
    const p1 = room.players.find((p) => p.slot === 1);
    if (state.lastResult.winner === "draw") {
      return `Draw · ${glyphFor(a)} vs ${glyphFor(b)}`;
    }
    const winner =
      state.lastResult.winner === 0 ? p0?.name : p1?.name;
    return `${winner ?? "Someone"} takes it · ${glyphFor(a)} vs ${glyphFor(b)}`;
  })();

  return (
    <div className="mx-auto w-full max-w-lg">
      {waiting ? (
        <ShareInvite
          code={room.code}
          copied={copied}
          onCopy={onCopyCode}
          need={1}
        />
      ) : null}

      <ol className="animate-rise mb-5 grid gap-2 sm:grid-cols-2">
        {[0, 1].map((slot) => {
          const player = room.players.find((p) => p.slot === slot);
          const pick = state.picks[slot];
          const score = state.scores[slot] ?? 0;
          const ready = Boolean(pick);
          return (
            <li
              key={slot}
              className={`flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 ${
                ready && playing && !over
                  ? "animate-beacon bg-cobalt/20"
                  : "bg-deep/30"
              }`}
              style={{ borderLeftColor: colorFor(slot) }}
            >
              <AvatarFace
                id={player?.avatar}
                size={32}
                title={player?.name ?? "Waiting"}
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {player?.name ?? "Waiting…"}
                </p>
                <p className="font-mono text-[11px] text-dim">
                  {score}/{state.target}
                  {(room.wins[slot] ?? 0) > 0
                    ? ` · ${room.wins[slot]}W`
                    : ""}
                </p>
              </div>
              <span className="text-2xl" aria-hidden>
                {playing
                  ? pick === "locked"
                    ? "🔒"
                    : pick
                      ? glyphFor(pick)
                      : "·"
                  : "·"}
              </span>
            </li>
          );
        })}
      </ol>

      {!waiting && state.status === "lobby" ? (
        <div className="animate-rise surface rounded-3xl p-6 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold">
            First to {state.target}
          </p>
          <p className="mt-2 text-sm text-dim">
            Simultaneous picks. Lock in. Reveal. Rematch.
          </p>
          {isHost ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                sfx.click();
                onAction("start");
              }}
              className="dopamine-roll mt-6 w-full rounded-2xl px-4 py-3.5 text-base"
            >
              Start duel
            </button>
          ) : (
            <p className="mt-6 text-sm text-dim">Waiting for host to start…</p>
          )}
        </div>
      ) : null}

      {playing && !over ? (
        <div className="animate-rise surface rounded-3xl p-5 text-center sm:p-6">
          {resultLine ? (
            <p className="mb-4 text-sm font-semibold text-lime">{resultLine}</p>
          ) : null}
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold">
            {lockedIn ? "Locked in — waiting…" : "Pick your throw"}
          </p>
          <p className="mt-1 text-xs text-dim">
            Round {Math.max(state.roundId, 1)} · best of unlimited, first to{" "}
            {state.target}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {CHOICES.map((c) => {
              const selected = myPick === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy || lockedIn}
                  onClick={() => {
                    sfx.place();
                    onAction("pick", { choice: c.id });
                  }}
                  className={`rounded-2xl border px-2 py-5 transition ${
                    selected
                      ? "border-lime/50 bg-lime/15"
                      : "border-edge/60 bg-deep/40 hover:border-lime/30 hover:bg-cobalt/15"
                  } disabled:opacity-50`}
                >
                  <span className="block text-3xl sm:text-4xl">{c.glyph}</span>
                  <span className="mt-2 block text-xs font-bold uppercase tracking-[0.14em]">
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {over ? (
        <p className="text-center text-sm text-dim">Duel over · results up</p>
      ) : null}
    </div>
  );
}
