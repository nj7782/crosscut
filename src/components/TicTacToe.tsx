"use client";

import { markFor, type PublicRoom, type TicTacToeState } from "@/lib/game";
import { colorFor } from "@/lib/theme";
import { sfx } from "@/lib/sfx";
import AvatarFace from "./AvatarFace";
import ShareInvite from "./ShareInvite";

type Me = { id: string; name: string; slot: number } | null;

export default function TicTacToe({
  room,
  state,
  me,
  busy,
  onMove,
  copied,
  onCopyCode,
}: {
  room: PublicRoom;
  state: TicTacToeState;
  me: Me;
  busy: boolean;
  onMove: (index: number) => void;
  copied: boolean;
  onCopyCode: () => void;
}) {
  const waiting = room.players.length < 2;
  const finished = state.winner !== null;
  const myTurn = !waiting && !finished && me?.slot === state.turn;
  const current = room.players.find((p) => p.slot === state.turn);

  return (
    <div className="mx-auto w-full max-w-md">
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
                <AvatarFace
                  id={player?.avatar}
                  size={36}
                  title={player?.name ?? "Waiting"}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="font-[family-name:var(--font-display)] text-2xl font-extrabold leading-none"
                    style={{ color: colorFor(slot) }}
                  >
                    {markFor(slot)}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {player?.name ?? "Waiting…"}
                  </p>
                  {(room.wins[slot] ?? 0) > 0 ? (
                    <p className="font-mono text-[11px] text-lime">{room.wins[slot]}W</p>
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
            ? "Your turn — make your move"
            : `${current?.name ?? "Opponent"} is thinking…`}
        </p>
      ) : finished ? (
        <p className="mb-4 text-center text-sm text-dim">Board locked · results up</p>
      ) : null}

      <div
        className={`animate-rise surface grid aspect-square grid-cols-3 gap-2.5 rounded-3xl p-2.5 ${
          waiting ? "pointer-events-none opacity-40" : ""
        }`}
      >
        {state.board.map((cell, index) => {
          const win = state.winningLine?.includes(index);
          const playable = myTurn && !cell && !finished;
          return (
            <button
              key={index}
              type="button"
              disabled={!playable || busy}
              onClick={() => {
                sfx.place();
                onMove(index);
              }}
              className={`flex aspect-square items-center justify-center rounded-2xl bg-[#050f2c]/70 font-[family-name:var(--font-display)] text-5xl font-extrabold transition sm:text-6xl ${
                playable ? "hover:bg-cobalt/25 hover:ring-1 hover:ring-sky/40" : ""
              } ${win ? "ttt-win-cell" : ""}`}
              aria-label={`Square ${index + 1}`}
            >
              {cell ? (
                <span
                  className="animate-pop"
                  style={{ color: cell === "X" ? colorFor(0) : colorFor(1) }}
                >
                  {cell}
                </span>
              ) : playable ? (
                <span className="text-sm font-semibold uppercase tracking-[0.14em] text-dim/40">
                  tap
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
