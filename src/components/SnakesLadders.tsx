"use client";

import { useEffect, useRef, useState } from "react";
import { LADDERS, SNAKES, boardRows } from "@/lib/game";
import type { LadderEvent, PublicRoom, SnakesLaddersState } from "@/lib/game";
import { colorFor } from "@/lib/theme";
import { sfx } from "@/lib/sfx";
import AvatarFace from "./AvatarFace";
import Die from "./Die";
import ShareInvite from "./ShareInvite";

type Me = { id: string; name: string; slot: number } | null;
type Pt = { x: number; y: number };

const ROWS = boardRows();

/* ------------------------------ board palette ----------------------------- */

/** Bright childhood-board palette: red, yellow, green, blue, orange. */
const CELL_PALETTE = [
  { fill: "#e5392c", ink: "#ffffff", halo: "#7a1410" },
  { fill: "#f9d43a", ink: "#1c1408", halo: "#fff6c8" },
  { fill: "#3cae4c", ink: "#ffffff", halo: "#17501f" },
  { fill: "#2a8be0", ink: "#ffffff", halo: "#0c3d70" },
  { fill: "#f4931f", ink: "#1c1408", halo: "#ffe3b8" },
] as const;

type SnakeSkin = { body: string; spot: string; outline: string; belly: string };

const SNAKE_SKINS: SnakeSkin[] = [
  { body: "#e63a2e", spot: "#f7c948", outline: "#6e130f", belly: "#ffb3a6" },
  { body: "#3aa845", spot: "#f2e14a", outline: "#1b5522", belly: "#b8f0bd" },
  { body: "#f2c22e", spot: "#e0522d", outline: "#7a5308", belly: "#fff0b3" },
  { body: "#7b3fc6", spot: "#d5b8f5", outline: "#351a63", belly: "#e2ccff" },
  { body: "#ef7d1a", spot: "#f9d76c", outline: "#7f3703", belly: "#ffd9b0" },
  { body: "#1f9fb8", spot: "#a6ecf2", outline: "#0b4a58", belly: "#c4f4fa" },
];

const FONT = 'var(--font-display), "Arial Black", Arial, system-ui, sans-serif';

/** Snakes in board order, each with the skin + bend used by both art and motion. */
const SNAKE_LIST = Object.entries(SNAKES).map(([f, t], i) => ({
  from: Number(f),
  to: t,
  skin: SNAKE_SKINS[i % SNAKE_SKINS.length],
  bend: i % 2 === 0 ? 1 : -1,
}));

const LADDER_LIST = Object.entries(LADDERS).map(([f, t]) => ({ from: Number(f), to: t }));

/* --------------------------------- geometry ------------------------------- */

/** Board percent coords: square 1 bottom-left, serpentine up to 100. */
function center(square: number): Pt {
  const idx = square - 1;
  const row = Math.floor(idx / 10);
  const inRow = idx % 10;
  const col = row % 2 === 0 ? inRow : 9 - inRow;
  return { x: (col + 0.5) * 10, y: (9 - row + 0.5) * 10 };
}

/** Where a token visually "is" for a square; 0 = START, just off the board edge. */
function tokenPoint(square: number): Pt {
  if (square < 1) return { x: -6, y: 95 };
  return center(square);
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Constant-speed sampler over a polyline: `at(u)` for u ∈ [0, 1]. */
function polyline(pts: Pt[]) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1] || 1;
  return {
    total,
    at(u: number): Pt {
      const d = Math.min(Math.max(u, 0), 1) * total;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const seg = cum[i] - cum[i - 1] || 1;
      return lerp(pts[i - 1], pts[i], (d - cum[i - 1]) / seg);
    },
  };
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

function gridPos(square: number) {
  const idx = square - 1;
  const row = Math.floor(idx / 10);
  const inRow = idx % 10;
  const col = row % 2 === 0 ? inRow : 9 - inRow;
  return { row, col };
}

/** Deterministic colour so no two neighbours share a colour. */
function paletteFor(square: number) {
  const { row, col } = gridPos(square);
  return CELL_PALETTE[(col * 2 + row * 3) % CELL_PALETTE.length];
}

function fmt(n: number) {
  return Math.round(n * 100) / 100;
}

function describe(event: LadderEvent, room: PublicRoom) {
  const who = room.players.find((p) => p.slot === event.slot)?.name ?? "Player";
  switch (event.kind) {
    case "win":
      return `${who} rolled ${event.roll} and hit 100!`;
    case "ladder":
      return `${who} climbed ${event.landed} → ${event.to}`;
    case "snake":
      return `${who} slid ${event.landed} → ${event.to}`;
    case "blocked":
      return `${who} rolled ${event.roll} — need exact finish on 100`;
    default:
      return `${who} moved to ${event.to}`;
  }
}

/* --------------------------------- ladders -------------------------------- */

function LadderGraphic({ from, to }: { from: number; to: number }) {
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const half = 1.55;

  const rail = (side: number) => ({
    x1: fmt(a.x + px * half * side),
    y1: fmt(a.y + py * half * side),
    x2: fmt(b.x + px * half * side),
    y2: fmt(b.y + py * half * side),
  });
  const left = rail(1);
  const right = rail(-1);

  const rungCount = Math.max(3, Math.round(len / 3.1));
  const rungs = Array.from({ length: rungCount - 1 }, (_, i) => {
    const t = (i + 1) / rungCount;
    const mx = a.x + dx * t;
    const my = a.y + dy * t;
    return {
      x1: fmt(mx + px * half),
      y1: fmt(my + py * half),
      x2: fmt(mx - px * half),
      y2: fmt(my - py * half),
    };
  });

  return (
    <g strokeLinecap="round">
      {/* dark outline pass */}
      <g stroke="#4a2708" strokeWidth={1.35}>
        <line {...left} />
        <line {...right} />
        {rungs.map((r, i) => (
          <line key={`o${i}`} {...r} strokeWidth={1.15} />
        ))}
      </g>
      {/* wood pass */}
      <g stroke="#b9772e" strokeWidth={0.8}>
        <line {...left} />
        <line {...right} />
        {rungs.map((r, i) => (
          <line key={`w${i}`} {...r} strokeWidth={0.6} stroke="#c98a3c" />
        ))}
      </g>
      {/* highlight */}
      <g stroke="#e9b36a" strokeWidth={0.22} opacity={0.9}>
        <line {...left} />
        <line {...right} />
      </g>
    </g>
  );
}

/* --------------------------------- snakes --------------------------------- */

function snakeSpine(a: Pt, b: Pt, bend: number): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const halfWaves = Math.max(2, Math.round(len / 15));
  const amp = Math.min(5.2, Math.max(2.4, len * 0.1)) * bend;
  const steps = 56;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const off = amp * Math.sin(halfWaves * Math.PI * t);
    pts.push({ x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off });
  }
  return pts;
}

function SnakeGraphic({
  from,
  to,
  skin,
  bend,
}: {
  from: number;
  to: number;
  skin: SnakeSkin;
  bend: number;
}) {
  const head = center(from); // high square
  const tail = center(to); // low square
  const pts = snakeSpine(head, tail, bend);
  const n = pts.length;

  const wHead = 1.45;
  const wTail = 0.32;
  const widthAt = (t: number) => wTail + (wHead - wTail) * Math.pow(1 - t, 0.85);

  const leftSide: string[] = [];
  const rightSide: string[] = [];
  const spots: { x: number; y: number; r: number }[] = [];

  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const t = i / (n - 1);
    const w = widthAt(t);
    leftSide.push(`${fmt(p.x + nx * w)} ${fmt(p.y + ny * w)}`);
    rightSide.push(`${fmt(p.x - nx * w)} ${fmt(p.y - ny * w)}`);
    if (i % 4 === 2 && i > 2 && i < n - 3) {
      spots.push({ x: fmt(p.x), y: fmt(p.y), r: fmt(w * 0.42) });
    }
  }
  const body = `M ${leftSide.join(" L ")} L ${rightSide.reverse().join(" L ")} Z`;
  const spine = `M ${pts.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(" L ")}`;

  // Head faces away from the body, along the reversed start tangent.
  const sx = pts[0].x - pts[2].x;
  const sy = pts[0].y - pts[2].y;
  const sl = Math.hypot(sx, sy) || 1;
  const fx = sx / sl;
  const fy = sy / sl;
  const angle = (Math.atan2(fy, fx) * 180) / Math.PI;
  const rx = 2.15;
  const ry = 1.7;
  const hc = { x: head.x + fx * 0.55, y: head.y + fy * 0.55 };
  const eye = (side: number) => ({
    x: fmt(hc.x + fx * 0.55 - fy * 0.8 * side),
    y: fmt(hc.y + fy * 0.55 + fx * 0.8 * side),
  });
  const e1 = eye(1);
  const e2 = eye(-1);
  const mouth = { x: hc.x + fx * rx, y: hc.y + fy * rx };
  const tongueMid = { x: mouth.x + fx * 1.1, y: mouth.y + fy * 1.1 };
  const forkA = { x: tongueMid.x + fx * 0.7 - fy * 0.55, y: tongueMid.y + fy * 0.7 + fx * 0.55 };
  const forkB = { x: tongueMid.x + fx * 0.7 + fy * 0.55, y: tongueMid.y + fy * 0.7 - fx * 0.55 };
  const tongue = `M ${fmt(mouth.x)} ${fmt(mouth.y)} L ${fmt(tongueMid.x)} ${fmt(tongueMid.y)} M ${fmt(tongueMid.x)} ${fmt(tongueMid.y)} L ${fmt(forkA.x)} ${fmt(forkA.y)} M ${fmt(tongueMid.x)} ${fmt(tongueMid.y)} L ${fmt(forkB.x)} ${fmt(forkB.y)}`;

  return (
    <g>
      <path d={body} fill={skin.body} stroke={skin.outline} strokeWidth={0.45} strokeLinejoin="round" />
      <path
        d={spine}
        fill="none"
        stroke={skin.belly}
        strokeWidth={0.32}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
      {spots.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={skin.spot} stroke={skin.outline} strokeWidth={0.12} />
      ))}
      {/* tongue (dark outline pass, then red) */}
      <path d={tongue} stroke="#3a0a12" strokeWidth={0.72} strokeLinecap="round" fill="none" />
      <path d={tongue} stroke="#e8304a" strokeWidth={0.36} strokeLinecap="round" fill="none" />
      {/* head */}
      <ellipse
        cx={fmt(hc.x)}
        cy={fmt(hc.y)}
        rx={rx}
        ry={ry}
        transform={`rotate(${fmt(angle)} ${fmt(hc.x)} ${fmt(hc.y)})`}
        fill={skin.body}
        stroke={skin.outline}
        strokeWidth={0.45}
      />
      <circle cx={e1.x} cy={e1.y} r={0.55} fill="#fff" stroke={skin.outline} strokeWidth={0.12} />
      <circle cx={e2.x} cy={e2.y} r={0.55} fill="#fff" stroke={skin.outline} strokeWidth={0.12} />
      <circle cx={fmt(e1.x + fx * 0.15)} cy={fmt(e1.y + fy * 0.15)} r={0.27} fill="#111" />
      <circle cx={fmt(e2.x + fx * 0.15)} cy={fmt(e2.y + fy * 0.15)} r={0.27} fill="#111" />
    </g>
  );
}

/* ---------------------------------- board --------------------------------- */

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${fmt(cx + Math.cos(ang) * rad)} ${fmt(cy + Math.sin(ang) * rad)}`);
  }
  return <polygon points={pts.join(" ")} fill="#ffd84a" stroke="#8a5a08" strokeWidth={0.3} strokeLinejoin="round" />;
}

function BoardArt() {
  const squares = ROWS.flat();

  return (
    <svg
      viewBox="0 0 100 100"
      className="block h-full w-full"
      aria-hidden="true"
      style={{ fontFamily: FONT }}
    >
      {/* cells */}
      {squares.map((sq) => {
        const c = center(sq);
        const pal = paletteFor(sq);
        const fill = sq === 1 ? "#2f9e44" : sq === 100 ? "#d7263d" : pal.fill;
        return <rect key={sq} x={c.x - 5} y={c.y - 5} width={10} height={10} fill={fill} />;
      })}

      {/* thick grid */}
      <g stroke="#111" strokeWidth={0.55} fill="none">
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={100} />
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 10} x2={100} y2={i * 10} />
        ))}
      </g>

      {/* ladders */}
      {LADDER_LIST.map(({ from, to }) => (
        <LadderGraphic key={`L${from}`} from={from} to={to} />
      ))}

      {/* snakes */}
      {SNAKE_LIST.map(({ from, to, skin, bend }) => (
        <SnakeGraphic key={`S${from}`} from={from} to={to} skin={skin} bend={bend} />
      ))}

      {/* numbers + hints, always on top */}
      <g fontWeight={800} style={{ paintOrder: "stroke fill" }}>
        {squares.map((sq) => {
          const c = center(sq);
          const pal = paletteFor(sq);
          const special = sq === 1 || sq === 100;
          const ink = special ? "#ffffff" : pal.ink;
          const halo = special ? (sq === 1 ? "#14522a" : "#5c0f1a") : pal.halo;
          const ladderTo = LADDERS[sq];
          const snakeTo = SNAKES[sq];
          return (
            <g key={`n${sq}`}>
              <text
                x={fmt(c.x - 4.2)}
                y={fmt(c.y - 1.9)}
                fontSize={2.9}
                fill={ink}
                stroke={halo}
                strokeWidth={0.55}
                strokeLinejoin="round"
              >
                {sq}
              </text>
              {ladderTo ? (
                <text
                  x={fmt(c.x + 4.3)}
                  y={fmt(c.y - 2.3)}
                  fontSize={1.9}
                  textAnchor="end"
                  fill="#d9ffe0"
                  stroke="#0f4a1f"
                  strokeWidth={0.45}
                >
                  ↑{ladderTo}
                </text>
              ) : null}
              {snakeTo ? (
                <text
                  x={fmt(c.x + 4.3)}
                  y={fmt(c.y - 2.3)}
                  fontSize={1.9}
                  textAnchor="end"
                  fill="#ffe0e0"
                  stroke="#6e0d0d"
                  strokeWidth={0.45}
                >
                  ↓{snakeTo}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>

      {/* START / FINISH badges */}
      <g style={{ paintOrder: "stroke fill" }} fontWeight={900} textAnchor="middle">
        <rect x={0.9} y={93.4} width={8.2} height={3.1} rx={0.9} fill="#fff9e6" stroke="#14522a" strokeWidth={0.35} />
        <text x={5} y={95.75} fontSize={2.05} fill="#14522a" letterSpacing={0.1}>
          START
        </text>
        <Star cx={8} cy={2.9} r={1.55} />
        <rect x={0.9} y={3.4} width={8.2} height={3.1} rx={0.9} fill="#fff9e6" stroke="#5c0f1a" strokeWidth={0.35} />
        <text x={5} y={5.75} fontSize={1.95} fill="#7a1220" letterSpacing={0.05}>
          FINISH
        </text>
      </g>

      {/* outer frame */}
      <rect x={0} y={0} width={100} height={100} fill="none" stroke="#111" strokeWidth={1.4} />
    </svg>
  );
}

const BOARD_ART = <BoardArt />;

/**
 * Offsets (board-percent) for N chips sharing one 10×10 cell. Everything stays
 * inside the cell: max half-extent is ~4.45 for 3-across and ~3.4 vertically.
 */
function tokenLayout(count: number) {
  const perRow = Math.min(3, count);
  const rows = Math.ceil(count / perRow);
  const size = count === 1 ? 3.4 : count <= 3 ? 2.7 : 2.3;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const col = i % perRow;
    const dx = (col - (inRow - 1) / 2) * (size + 0.4);
    // Numbers sit in the top-left of each cell; nudge chips a hair below the
    // geometric centre so a single chip clears the digits but stays well inside.
    const baseY = 0.7;
    const dy = baseY + (row - (rows - 1) / 2) * (size + 0.35);
    return { dx, dy, size };
  });
}

/* --------------------------------- motion --------------------------------- */

type MotionPhase = "hop" | "ladder" | "snake" | "bump";

type Motion = {
  slot: number;
  pt: Pt;
  phase: MotionPhase;
  /** Bumps once per hop so the chip keyframe restarts. */
  step: number;
};

const DIE_WAIT_MS = 520; // let the Die finish its face-flash first
const HOP_MS = 210;
const PATH_PAUSE_MS = 260;
const SETTLE_MS = 140;
const MOVING_SIZE = 3.6;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Points the chip travels along for a ladder climb or snake slide. */
function specialPath(kind: "ladder" | "snake", landed: number, to: number): Pt[] {
  const a = center(landed);
  const b = center(to);
  if (kind === "snake") {
    const snake = SNAKE_LIST.find((s) => s.from === landed);
    return snakeSpine(a, b, snake?.bend ?? 1);
  }
  return [a, b];
}

function shouldAnimate(state: SnakesLaddersState): state is SnakesLaddersState & {
  lastEvent: LadderEvent;
} {
  return Boolean(state.lastEvent) && state.status !== "lobby" && !prefersReducedMotion();
}

/**
 * Client-side presentation of `state.lastEvent`. Server state is the source
 * of truth; this only decides where the mover's chip is drawn for ~1–3s after
 * a new `rollId` arrives (from → landed as hops, then landed → to along the
 * ladder/snake geometry). Returns null when nothing is moving.
 */
function useTokenMotion(state: SnakesLaddersState): Motion | null {
  const [motion, setMotion] = useState<Motion | null>(null);
  const [trackedRoll, setTrackedRoll] = useState(state.rollId);
  const seenRoll = useRef(state.rollId);
  // Serialised so the effect only re-runs when the event itself changes (a
  // fresh room object from polling, e.g. a reaction, must not cancel a run).
  const eventKey = JSON.stringify(state.lastEvent);
  const { rollId, status } = state;

  // New roll arrived: park the mover on its *starting* square during this very
  // render so it never flashes at the destination before the timeline starts.
  if (rollId !== trackedRoll) {
    setTrackedRoll(rollId);
    setMotion(
      shouldAnimate(state)
        ? { slot: state.lastEvent.slot, pt: tokenPoint(state.lastEvent.from), phase: "hop", step: 0 }
        : null,
    );
  }

  useEffect(() => {
    if (rollId === seenRoll.current) return;
    seenRoll.current = rollId;

    const ev = JSON.parse(eventKey) as LadderEvent | null;
    if (!ev || status === "lobby" || prefersReducedMotion()) return;

    let cancelled = false;
    let raf = 0;
    let timer = 0;
    const slot = ev.slot;
    let step = 0;

    const place = (pt: Pt, phase: MotionPhase, bump = false) => {
      if (cancelled) return;
      if (bump) step += 1;
      setMotion({ slot, pt, phase, step });
    };

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });

    // rAF for smoothness, with a timer fallback so the run still completes in
    // throttled/occluded tabs (embedded webviews can pause rAF while "visible").
    const tween = (ms: number, onFrame: (t: number) => void) =>
      new Promise<void>((resolve) => {
        const t0 = performance.now();
        const frame = () => {
          cancelAnimationFrame(raf);
          window.clearTimeout(timer);
          if (cancelled) return;
          const t = Math.min(1, (performance.now() - t0) / ms);
          onFrame(t);
          if (t < 1) schedule();
          else resolve();
        };
        const schedule = () => {
          raf = requestAnimationFrame(frame);
          timer = window.setTimeout(frame, 64);
        };
        schedule();
      });

    const run = async () => {
      // The mover is already parked at `from` (render-time adjust above).
      await wait(DIE_WAIT_MS);
      if (cancelled) return;

      if (ev.kind === "blocked") {
        place(tokenPoint(ev.from), "bump", true);
        await wait(520);
        if (!cancelled) setMotion(null);
        return;
      }

      // 1) Hop square-by-square from → landed.
      let at = tokenPoint(ev.from);
      for (let sq = ev.from + 1; sq <= ev.landed; sq++) {
        const next = tokenPoint(sq);
        const start = at;
        step += 1;
        sfx.place();
        await tween(HOP_MS, (t) => {
          if (cancelled) return;
          setMotion({ slot, pt: lerp(start, next, easeOutQuad(t)), phase: "hop", step });
        });
        if (cancelled) return;
        at = next;
      }

      // 2) Ladder climb / snake slide along the drawn geometry.
      if (ev.kind === "ladder" || ev.kind === "snake") {
        await wait(PATH_PAUSE_MS);
        if (cancelled) return;
        const phase: MotionPhase = ev.kind;
        const path = polyline(specialPath(ev.kind, ev.landed, ev.to));
        const isSnake = ev.kind === "snake";
        const ms = isSnake ? 520 + path.total * 13 : 560 + path.total * 15;
        const ease = isSnake ? easeInOutCubic : easeInOutSine;
        if (isSnake) sfx.bust();
        else sfx.win();
        place(at, phase, true);
        await tween(ms, (t) => {
          if (cancelled) return;
          setMotion({ slot, pt: path.at(ease(t)), phase, step });
        });
        if (cancelled) return;
        at = center(ev.to);
      }

      // 3) Settle and hand the chip back to the static layer.
      place(at, "hop", true);
      await wait(SETTLE_MS);
      if (!cancelled) setMotion(null);
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [rollId, eventKey, status]);

  return motion;
}

const PHASE_CLASS: Record<MotionPhase, string> = {
  hop: "token-hop",
  ladder: "token-climb",
  snake: "token-slide",
  bump: "token-bump",
};

/**
 * One chip on the board. The outer wrapper owns position + centring
 * (`translate(-50%,-50%)`); the inner chip owns any keyframe animation so the
 * two transforms never fight.
 */
function BoardChip({
  name,
  slot,
  x,
  y,
  size,
  phase,
  step = 0,
}: {
  name: string;
  slot: number;
  x: number;
  y: number;
  size: number;
  phase?: MotionPhase;
  step?: number;
}) {
  const moving = phase !== undefined;
  return (
    <span
      className={`absolute ${moving ? "z-[4]" : ""}`}
      title={name}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}%`,
        height: `${size}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span
        // Re-keying restarts the keyframe for every hop.
        key={moving ? `${phase}-${step}` : "static"}
        className={`classic-token block h-full w-full ${phase ? PHASE_CLASS[phase] : ""}`}
        style={{
          background: `radial-gradient(circle at 35% 30%, #fff9, transparent 45%), ${colorFor(slot)}`,
          boxShadow: moving
            ? `0 0 0 1.5px #fff, 0 0 0 2.5px #111, 0 0 0 5px ${colorFor(slot)}55, 0 4px 8px rgba(0,0,0,.55)`
            : "0 0 0 1.5px #fff, 0 0 0 2.5px #111, 0 2px 4px rgba(0,0,0,.5)",
        }}
      />
    </span>
  );
}

export default function SnakesLadders({
  room,
  state,
  me,
  busy,
  onAction,
  copied,
  onCopyCode,
}: {
  room: PublicRoom;
  state: SnakesLaddersState;
  me: Me;
  busy: boolean;
  onAction: (type: string) => void;
  copied: boolean;
  onCopyCode: () => void;
}) {
  const isHost = me?.slot === 0;
  const myTurn = state.status === "playing" && me?.slot === state.turn;
  const current = room.players.find((p) => p.slot === state.turn);
  const atStart = room.players.filter((p) => (state.positions[p.slot] ?? 0) === 0);
  const needPlayers = Math.max(2 - room.players.length, 0);

  const motion = useTokenMotion(state);
  const mover = motion ? room.players.find((p) => p.slot === motion.slot) : undefined;

  // Static chips: everyone except the one currently animating.
  const occupied = new Map<number, typeof room.players>();
  for (const p of room.players) {
    if (motion && p.slot === motion.slot) continue;
    const sq = state.positions[p.slot] ?? 0;
    if (sq < 1 || sq > 100) continue;
    const list = occupied.get(sq) ?? [];
    list.push(p);
    occupied.set(sq, list);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <section className="animate-rise">
        <div className="classic-board-frame mx-auto w-full max-w-[640px]">
          <div className="classic-board relative aspect-square overflow-hidden">
            {BOARD_ART}

            {/* tokens layer, positioned in board-percent space */}
            <div className="pointer-events-none absolute inset-0 z-[3]">
              {Array.from(occupied.entries()).flatMap(([sq, players]) => {
                const c = center(sq);
                const layout = tokenLayout(players.length);
                return players.map((p, i) => {
                  const l = layout[i];
                return (
                    <BoardChip
                      key={p.id}
                      name={p.name}
                      slot={p.slot}
                      x={c.x + l.dx}
                      y={c.y + l.dy}
                      size={l.size}
                    />
                  );
                });
              })}

              {motion && mover ? (
                <BoardChip
                  key={`mover-${mover.id}`}
                  name={mover.name}
                  slot={mover.slot}
                  x={motion.pt.x}
                  y={motion.pt.y}
                  size={MOVING_SIZE}
                  phase={motion.phase}
                  step={motion.step}
                />
                  ) : null}
                </div>
          </div>
        </div>

          {atStart.length ? (
          <div className="mx-auto mt-3 flex max-w-[640px] flex-wrap items-center gap-2 rounded-xl border border-[#c4a574]/40 bg-[#fff8e8]/90 px-3 py-2 text-xs text-[#5c4018]">
            <span className="font-semibold">Waiting at START:</span>
              {atStart.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 font-medium">
                <span
                  className="classic-token"
                  style={{ background: colorFor(p.slot) }}
                />
                {p.name}
              </span>
              ))}
          </div>
          ) : null}

        <p className="mx-auto mt-2 max-w-[640px] text-center text-[11px] text-dim">
          Ladder foot lifts you up · snake head sends you down · exact 100 to win · 6 = extra roll
        </p>
      </section>

      <section className="animate-rise space-y-4" style={{ animationDelay: "90ms" }}>
        <ol className="space-y-1.5">
          {room.players.map((p) => {
            const active = state.status === "playing" && p.slot === state.turn;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 transition ${
                  active ? "animate-beacon bg-cobalt/20" : "bg-deep/30"
                }`}
                style={{ borderLeftColor: colorFor(p.slot) }}
              >
                <AvatarFace
                  id={p.avatar}
                  size={28}
                  title={p.name}
                  className="shrink-0 ring-2"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {p.name}
                  {p.id === me?.id ? <span className="text-dim"> · you</span> : null}
                </span>
                <span className="font-mono text-sm text-dim">
                  {(state.positions[p.slot] ?? 0) || "—"}
                </span>
                {room.wins[p.slot] ? (
                  <span className="font-mono text-xs text-lime">{room.wins[p.slot]}w</span>
                ) : null}
              </li>
            );
          })}
        </ol>

        {state.status === "lobby" ? (
          <div className="space-y-3">
            {needPlayers > 0 ? (
              <ShareInvite
                code={room.code}
                copied={copied}
                onCopy={onCopyCode}
                need={needPlayers}
              />
            ) : null}
          <div className="surface rounded-2xl p-4">
            <p className="font-[family-name:var(--font-display)] text-lg font-bold">
              Lobby · {room.players.length}/{room.maxPlayers}
            </p>
            <p className="mt-1 text-sm text-dim">
                {needPlayers > 0
                  ? "Once a friend joins, you can start the race."
                  : "Host starts when everyone is ready. You can still invite more."}
            </p>
              {needPlayers === 0 && isHost ? (
              <button
                type="button"
                  disabled={busy}
                  onClick={() => {
                    sfx.click();
                    onAction("start");
                  }}
                  className="dopamine-roll mt-4 w-full rounded-2xl px-4 py-3.5 text-base"
                >
                  Start game ({room.players.length})
              </button>
              ) : null}
              {needPlayers === 0 && !isHost ? (
              <p className="mt-4 text-sm text-sky">Waiting for the host to start…</p>
              ) : null}
              {needPlayers === 0 ? (
                <button
                  type="button"
                  onClick={onCopyCode}
                  className="btn-ghost mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
                >
                  {copied ? "Code copied" : "Copy code — invite another"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {state.status === "playing" ? (
          <div className="surface rounded-2xl p-4">
            <div
              className="mb-4 rounded-xl border px-3 py-3 text-center"
              style={{
                borderColor: `${colorFor(current?.slot ?? 0)}55`,
                background: `${colorFor(current?.slot ?? 0)}14`,
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-dim">
                {myTurn ? "Your turn" : "Now rolling"}
              </p>
              <p
                className="mt-1 font-[family-name:var(--font-display)] text-xl font-extrabold"
                style={{ color: colorFor(current?.slot ?? 0) }}
              >
                {myTurn
                  ? "Roll the die"
                  : `${current?.name ?? "Someone"}'s roll`}
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Die
                value={state.lastEvent?.roll ?? null}
                rollId={state.rollId}
                showNumber
              />
              <p className="min-h-[2.5rem] text-center font-[family-name:var(--font-display)] text-base font-bold leading-snug">
                {state.lastEvent ? (
                  <>
                    {state.lastEvent.roll === 6 ? (
                      <span className="text-lime">Six! Roll again · </span>
                    ) : null}
                    {describe(state.lastEvent, room)}
                  </>
                ) : (
                  <span className="text-dim">Waiting for the first roll.</span>
                )}
              </p>
            </div>
            <button
              type="button"
              disabled={!myTurn || busy}
              onClick={() => {
                sfx.roll();
                onAction("roll");
              }}
              className="dopamine-roll mt-4 w-full rounded-2xl px-4 py-4 text-lg font-extrabold disabled:opacity-40"
            >
              {myTurn ? "ROLL" : `Waiting for ${current?.name ?? "…"}`}
            </button>
          </div>
        ) : null}

        {state.status === "over" ? (
          <div className="surface rounded-2xl p-4 text-center text-sm text-dim">
            Board frozen · results up
          </div>
        ) : null}
      </section>
    </div>
  );
}
