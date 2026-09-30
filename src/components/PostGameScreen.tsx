"use client";

import { isFinished, type PublicRoom } from "@/lib/game";
import { colorFor } from "@/lib/theme";
import { sfx } from "@/lib/sfx";
import AvatarFace from "./AvatarFace";

type Me = { id: string; name: string; slot: number } | null;

function matchSummary(room: PublicRoom): string {
  const state = room.state;
  if (state.kind === "tictactoe") {
    if (state.winner === "draw") return "Board filled — nobody got three.";
    return "Three in a row.";
  }
  if (state.kind === "connect4") {
    if (state.winner === "draw") return "Board filled — nobody got four.";
    return "Four in a line.";
  }
  if (state.kind === "rps") {
    const lines = room.players
      .map((p) => `${p.name} ${state.scores[p.slot] ?? 0}`)
      .join(" · ");
    return `First to ${state.target} · ${lines}`;
  }
  if (state.kind === "dice") {
    const lines = room.players
      .map((p) => `${p.name} ${state.scores[p.slot] ?? 0}`)
      .join(" · ");
    return `Final bank · ${lines}`;
  }
  if (state.kind === "snakesladders") {
    const lines = [...room.players]
      .sort(
        (a, b) =>
          (state.positions[b.slot] ?? 0) - (state.positions[a.slot] ?? 0),
      )
      .map((p) => `${p.name} @ ${(state.positions[p.slot] ?? 0) || "START"}`)
      .join(" · ");
    return `Board finish · ${lines}`;
  }
  return "";
}

export default function PostGameScreen({
  room,
  me,
  busy,
  onRematch,
  onLeave,
}: {
  room: PublicRoom;
  me: Me;
  busy?: boolean;
  onRematch: () => void;
  onLeave: () => void;
}) {
  if (!isFinished(room.state)) return null;

  const winnerSlot =
    typeof room.state.winner === "number" ? room.state.winner : null;
  const isDraw = room.state.winner === "draw";
  const winner =
    winnerSlot !== null
      ? room.players.find((p) => p.slot === winnerSlot)
      : null;
  const iWon = Boolean(winner && me && winner.id === me.id);

  const standings = [...room.players].sort((a, b) => {
    const dw = (room.wins[b.slot] ?? 0) - (room.wins[a.slot] ?? 0);
    if (dw !== 0) return dw;
    return a.slot - b.slot;
  });

  const totalWins = room.players.reduce(
    (sum, p) => sum + (room.wins[p.slot] ?? 0),
    0,
  );
  const headline = isDraw
    ? "Dead heat"
    : iWon
      ? "You win"
      : `${winner?.name ?? "Someone"} wins`;

  const sub = isDraw
    ? "Nobody takes this round."
    : iWon
      ? "That's the one. Hit rematch while they're still here."
      : "Tough one — rematch is the only cure.";

  return (
    <div className="postgame" role="dialog" aria-label="Match results">
      <div className="postgame-scrim" aria-hidden="true" />
      <div className="postgame-panel animate-rise">
        <div className="postgame-sparks" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="postgame-spark" style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>

        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-lime">
          Match over · Round {room.round}
        </p>

        <h2
          className="mt-3 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-none sm:text-5xl"
          style={{
            color: isDraw
              ? undefined
              : colorFor(winnerSlot ?? me?.slot ?? 0),
          }}
        >
          {headline}
        </h2>
        <p className="mt-3 text-sm text-dim">{sub}</p>
        <p className="mt-2 text-xs text-dim/80">{matchSummary(room)}</p>

        <div className="mt-6 text-left">
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-dim">
            Session standings
            {totalWins > 0 ? ` · ${totalWins} game${totalWins === 1 ? "" : "s"}` : ""}
          </p>
          <ol className="space-y-1.5">
            {standings.map((p, rank) => {
              const wins = room.wins[p.slot] ?? 0;
              const isChamp = winnerSlot === p.slot;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 ${
                    isChamp ? "bg-lime/10" : "bg-deep/40"
                  }`}
                  style={{ borderLeftColor: colorFor(p.slot) }}
                >
                  <span className="w-5 font-mono text-xs text-dim">
                    {rank + 1}
                  </span>
                  <AvatarFace id={p.avatar} size={28} title={p.name} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {p.name}
                    {p.id === me?.id ? (
                      <span className="text-dim"> · you</span>
                    ) : null}
                    {isChamp && !isDraw ? (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-lime">
                        this round
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="font-[family-name:var(--font-display)] text-lg font-extrabold tabular-nums"
                    style={{ color: colorFor(p.slot) }}
                  >
                    {wins}
                    <span className="ml-0.5 text-xs font-bold text-dim">W</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            sfx.click();
            onRematch();
          }}
          className="dopamine-roll mt-6 w-full rounded-2xl px-4 py-4 text-lg font-extrabold"
        >
          Rematch
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            sfx.click();
            onLeave();
          }}
          className="btn-ghost mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold"
        >
          Leave room
        </button>
        <p className="mt-3 text-center text-[11px] text-dim">
          Same room · same people · fresh round
        </p>
      </div>
    </div>
  );
}
