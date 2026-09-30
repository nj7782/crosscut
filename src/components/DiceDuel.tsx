"use client";

import { useEffect, useRef, useState } from "react";
import type { DiceState, PublicRoom } from "@/lib/game";
import { colorFor } from "@/lib/theme";
import { sfx } from "@/lib/sfx";
import AvatarFace from "./AvatarFace";
import Die from "./Die";
import ShareInvite from "./ShareInvite";

type Me = { id: string; name: string; slot: number } | null;

function useBumpNumber(value: number) {
  const prev = useRef(value);
  const [bump, setBump] = useState(false);
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    if (value === prev.current) return;
    const d = value - prev.current;
    prev.current = value;
    setDelta(d);
    setBump(true);
    const t = window.setTimeout(() => {
      setBump(false);
      setDelta(null);
    }, 700);
    return () => window.clearTimeout(t);
  }, [value]);

  return { bump, delta };
}

export default function DiceDuel({
  room,
  state,
  me,
  busy,
  onAction,
  copied,
  onCopyCode,
}: {
  room: PublicRoom;
  state: DiceState;
  me: Me;
  busy: boolean;
  onAction: (type: "roll" | "bank" | "start") => void;
  copied: boolean;
  onCopyCode: () => void;
}) {
  const heard = useRef(0);
  const isHost = me?.slot === 0;
  const playing = state.status === "playing";
  const over = state.status === "over" || state.winner !== null;
  const myTurn = playing && !over && me?.slot === state.turn;
  const current = room.players.find((p) => p.slot === state.turn);
  const needPlayers = Math.max(2 - room.players.length, 0);
  const potBump = useBumpNumber(state.pot);
  const roller =
    state.lastRollBy !== null && state.lastRollBy !== undefined
      ? room.players.find((p) => p.slot === state.lastRollBy)
      : null;

  useEffect(() => {
    if (state.rollId === heard.current) return;
    heard.current = state.rollId;
    if (state.lastEvent === "bust") sfx.bust();
  }, [state.rollId, state.lastEvent]);

  const resultLine = (() => {
    if (!roller || !state.lastEvent) return null;
    const who = roller.id === me?.id ? "You" : roller.name;
    if (state.lastEvent === "bust") return `${who} rolled 1 — BUST`;
    if (state.lastEvent === "again")
      return `${who} rolled ${state.lastRoll} (+${state.lastGain}) · roll again!`;
    if (state.lastEvent === "bank")
      return `${who} banked +${state.lastBank} → ${state.scores[roller.slot] ?? 0}`;
    if (state.lastEvent === "roll")
      return `${who} rolled ${state.lastRoll} (+${state.lastGain})`;
    return null;
  })();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 lg:grid-cols-[minmax(0,1.15fr)_15rem]">
      <div className="space-y-4">
        <ol className="animate-rise grid gap-2 sm:grid-cols-2">
          {room.players.map((p) => {
            const active = playing && !over && p.slot === state.turn;
            const score = state.scores[p.slot] ?? 0;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 ${
                  active ? "animate-beacon bg-cobalt/20" : "bg-deep/30"
                }`}
                style={{ borderLeftColor: colorFor(p.slot) }}
              >
                <AvatarFace id={p.avatar} size={32} title={p.name} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.name}
                    {p.id === me?.id ? <span className="text-dim"> · you</span> : null}
                  </p>
                  <p className="text-[11px] text-dim">
                    {over
                      ? `${room.wins[p.slot] ?? 0}W this session`
                      : active
                        ? "has the dice"
                        : `${Math.max(state.target - score, 0)} to win`}
                  </p>
                </div>
                <p
                  className="font-[family-name:var(--font-display)] text-2xl font-extrabold tabular-nums"
                  style={{ color: colorFor(p.slot) }}
                >
                  {score}
                </p>
              </li>
            );
          })}
          {needPlayers > 0
            ? Array.from({ length: needPlayers }, (_, i) => (
                <li
                  key={`open-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-edge/70 px-3 py-2.5 text-sm text-dim"
                >
                  Open seat — invite a friend
                </li>
              ))
            : null}
        </ol>

        {state.status === "lobby" && needPlayers > 0 ? (
          <ShareInvite
            code={room.code}
            copied={copied}
            onCopy={onCopyCode}
            need={needPlayers}
          />
        ) : null}

        <div className="animate-rise surface rounded-3xl p-5 text-center sm:p-6">
          {over ? (
            <p className="text-sm text-dim">Table frozen · results up</p>
          ) : playing ? (
            <p
              className="mb-4 text-sm font-bold uppercase tracking-[0.18em]"
              style={{ color: colorFor(current?.slot ?? 0) }}
            >
              {myTurn ? "Your turn" : `${current?.name ?? "Someone"}'s turn`}
            </p>
          ) : null}

          <div className="relative mx-auto inline-block">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-dim">
              Pot on the table
            </p>
            <p
              key={`pot-${state.pot}-${state.rollId}`}
              className={`font-[family-name:var(--font-display)] text-6xl font-extrabold leading-none text-amber sm:text-7xl ${
                potBump.bump ? "pot-bump" : ""
              } ${state.lastEvent === "bust" ? "pot-bust" : ""}`}
            >
              {state.pot}
            </p>
            {potBump.delta !== null && potBump.delta !== 0 ? (
              <span
                className={`pot-delta ${potBump.delta > 0 ? "pot-delta-up" : "pot-delta-down"}`}
              >
                {potBump.delta > 0 ? `+${potBump.delta}` : potBump.delta}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-dim">
            Race to {state.target} · 1 in 6 chance to bust
          </p>

          <div className="mt-5 flex justify-center">
            {state.lastRoll || (playing && !over) ? (
              <Die
                value={state.lastRoll}
                rollId={state.rollId}
                showNumber
                size="lg"
              />
            ) : null}
          </div>

          {resultLine && !over ? (
            <p className="mt-4 animate-pop text-sm font-semibold text-paper">
              {resultLine}
            </p>
          ) : null}

          {state.status === "lobby" && needPlayers === 0 ? (
            isHost ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  sfx.click();
                  onAction("start");
                }}
                className="dopamine-roll mt-6 w-full rounded-2xl px-4 py-3.5 text-base"
              >
                Start table ({room.players.length})
              </button>
            ) : (
              <p className="mt-6 text-sm text-sky">Waiting for host…</p>
            )
          ) : null}

          {playing && !over ? (
            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={!myTurn || busy}
                onClick={() => {
                  sfx.roll();
                  onAction("roll");
                }}
                className="dopamine-roll w-full rounded-2xl px-4 py-5 text-xl font-extrabold disabled:opacity-40"
              >
                {myTurn ? "ROLL" : `Waiting for ${current?.name ?? "…"}`}
              </button>
              <button
                type="button"
                disabled={!myTurn || busy || state.pot === 0}
                onClick={() => {
                  sfx.click();
                  onAction("bank");
                }}
                className="btn-ghost w-full rounded-xl px-4 py-3 text-base font-bold"
              >
                {state.pot > 0 ? `BANK +${state.pot}` : "BANK"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="animate-rise surface h-fit rounded-2xl p-4 text-left text-sm">
        <p className="font-[family-name:var(--font-display)] text-base font-bold text-amber">
          How to duel
        </p>
        <ul className="mt-3 space-y-2 text-dim">
          <li>
            <span className="text-paper">2–6</span> → add to pot
          </li>
          <li>
            <span className="text-lime">6</span> → keep rolling
          </li>
          <li>
            <span className="text-flare">1</span> → bust, pot gone
          </li>
          <li>
            <span className="text-paper">Bank</span> → lock pot, pass the dice
          </li>
          <li>First to {state.target} wins</li>
        </ul>
      </aside>
    </div>
  );
}
