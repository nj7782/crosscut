"use client";

import { useEffect, useRef } from "react";
import {
  C4_COLS,
  C4_ROWS,
  type Connect4State,
  type PublicRoom,
} from "@/lib/game";
import { colorFor } from "@/lib/theme";
import { sfx } from "@/lib/sfx";
import AvatarFace from "./AvatarFace";
import ShareInvite from "./ShareInvite";

type Me = { id: string; name: string; slot: number } | null;

export default function ConnectFour({
  room,
  state,
  me,
  busy,
  onDrop,
  copied,
  onCopyCode,
}: {
  room: PublicRoom;
  state: Connect4State;
  me: Me;
  busy: boolean;
  onDrop: (col: number) => void;
  copied: boolean;
  onCopyCode: () => void;
}) {
  const waiting = room.players.length < 2;
  const finished = state.winner !== null;
  const myTurn = !waiting && !finished && me?.slot === state.turn;
  const current = room.players.find((p) => p.slot === state.turn);
  const heardDrop = useRef(state.lastDrop);

  useEffect(() => {
    if (state.lastDrop === null || state.lastDrop === heardDrop.current) return;
    heardDrop.current = state.lastDrop;
    sfx.place();
  }, [state.lastDrop]);

  function columnFull(col: number) {
    return state.board[col] !== null;
  }

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

      <div
        className={`animate-rise mb-4 flex items-center gap-3 ${waiting ? "mt-5 opacity-55" : ""}`}
      >
        {[0, 1].map((slot, i) => {
          const player = room.players.find((p) => p.slot === slot);
          const active = !waiting && !finished && state.turn === slot;
          return (
            <div key={slot} className="flex flex-1 items-center gap-3">
              {i === 1 ? (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-dim">
                  vs
                </span>
              ) : null}
              <div
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                  active
                    ? "animate-beacon border-lime/40 bg-cobalt/20"
                    : "border-edge/50 bg-deep/30"
                } ${slot === 1 ? "flex-row-reverse text-right" : ""}`}
              >
                <span
                  className="inline-block h-4 w-4 shrink-0 rounded-full ring-2 ring-ink/40"
                  style={{ background: colorFor(slot) }}
                  aria-hidden
                />
                <AvatarFace
                  id={player?.avatar}
                  size={36}
                  title={player?.name ?? "Waiting"}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {player?.name ?? "Waiting…"}
                  </p>
                  {(room.wins[slot] ?? 0) > 0 ? (
                    <p className="font-mono text-[11px] text-lime">
                      {room.wins[slot]}W
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!finished && !waiting ? (
        <p
          className="animate-rise mb-4 text-center font-[family-name:var(--font-display)] text-2xl font-bold"
          style={{
            color: myTurn ? colorFor(me?.slot ?? 0) : undefined,
          }}
        >
          {myTurn
            ? "Your turn — drop a disc"
            : `${current?.name ?? "Opponent"} is lining up…`}
        </p>
      ) : finished ? (
        <p className="mb-4 text-center text-sm text-dim">
          Grid locked · results up
        </p>
      ) : null}

      <div
        className={`animate-rise surface rounded-3xl p-3 sm:p-4 ${
          waiting ? "pointer-events-none opacity-40" : ""
        }`}
      >
        <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: C4_COLS }, (_, col) => {
            const playable = myTurn && !columnFull(col) && !finished;
            return (
              <button
                key={col}
                type="button"
                disabled={!playable || busy}
                aria-label={`Drop in column ${col + 1}`}
                onClick={() => {
                  sfx.click();
                  onDrop(col);
                }}
                className={`flex h-8 items-center justify-center rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                  playable
                    ? "bg-lime/15 text-lime hover:bg-lime/25"
                    : "text-dim/40"
                }`}
              >
                ▼
              </button>
            );
          })}
        </div>

        <div
          className="grid gap-1.5 rounded-2xl bg-[#0a1630]/p-2 sm:gap-2 sm:p-3"
          style={{
            gridTemplateColumns: `repeat(${C4_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${C4_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: C4_ROWS * C4_COLS }, (_, index) => {
            const cell = state.board[index];
            const win = state.winningLine?.includes(index);
            const isLast = state.lastDrop === index;
            return (
              <div
                key={index}
                className={`aspect-square rounded-full border border-white/10 bg-[#061022] ${
                  win ? "ring-2 ring-lime shadow-[0_0_12px_rgba(201,242,74,0.45)]" : ""
                } ${isLast && !win ? "animate-rise" : ""}`}
              >
                {cell !== null ? (
                  <span
                    className="block h-full w-full rounded-full shadow-inner"
                    style={{
                      background: `radial-gradient(circle at 32% 28%, #fff6, transparent 42%), ${colorFor(cell)}`,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
