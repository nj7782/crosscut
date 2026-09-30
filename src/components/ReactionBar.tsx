"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  REACTION_OPTIONS,
  type PublicRoom,
  type ReactionText,
  type RoomReaction,
} from "@/lib/game";
import { sfx } from "@/lib/sfx";
import AvatarFace from "./AvatarFace";

type Floater = {
  key: string;
  emoji: string;
  name: string;
  avatar: string;
  left: number;
  drift: number;
  size: number;
  delay: number;
};

function spawnFromReaction(r: RoomReaction): Floater {
  return {
    key: `${r.id}-${Math.random().toString(36).slice(2, 6)}`,
    emoji: r.text,
    name: r.name,
    avatar: r.avatar || "luffy",
    left: 10 + Math.random() * 80,
    drift: -36 + Math.random() * 72,
    size: 2.4 + Math.random() * 1.2,
    delay: Math.random() * 0.2,
  };
}

export default function ReactionBar({
  room,
  myId,
  myName,
  myAvatar,
  onReact,
  disabled,
}: {
  room: PublicRoom;
  myId?: string;
  myName?: string;
  myAvatar?: string;
  onReact: (text: ReactionText) => void;
  disabled?: boolean;
}) {
  const seen = useRef(new Set<string>());
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [bursting, setBursting] = useState<ReactionText | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const list = room.reactions ?? [];
    if (seen.current.size === 0 && list.length) {
      for (const r of list) seen.current.add(r.id);
    }
  }, [room.code]);

  useEffect(() => {
    const list = room.reactions ?? [];
    const fresh: Floater[] = [];
    for (const r of list) {
      if (seen.current.has(r.id)) continue;
      seen.current.add(r.id);
      if (r.playerId === myId) continue;
      fresh.push(spawnFromReaction(r));
    }
    if (!fresh.length) return;
    setFloaters((prev) => [...prev, ...fresh].slice(-40));
  }, [room.reactions, myId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function tap(emoji: ReactionText) {
    if (disabled) return;
    const who = myName?.trim() || "You";
    const me = room.players.find((p) => p.id === myId);
    setFloaters((prev) =>
      [
        ...prev,
        spawnFromReaction({
          id: `local-${Date.now()}`,
          playerId: myId ?? "me",
          name: who,
          slot: me?.slot ?? 0,
          avatar: myAvatar || me?.avatar || "luffy",
          text: emoji,
          at: Date.now(),
        }),
      ].slice(-40),
    );
    setBursting(emoji);
    window.setTimeout(() => setBursting(null), 180);
    sfx.react();
    onReact(emoji);
    setOpen(false);
  }

  function prune(key: string) {
    setFloaters((prev) => prev.filter((f) => f.key !== key));
  }

  return (
    <>
      <div className="reaction-stage" aria-hidden="true">
        {floaters.map((f) => (
          <span
            key={f.key}
            className="reaction-emoji"
            style={
              {
                left: `${f.left}%`,
                "--drift": `${f.drift}px`,
                "--size": `${f.size}rem`,
                animationDelay: `${f.delay}s`,
              } as CSSProperties
            }
            onAnimationEnd={() => prune(f.key)}
          >
            <span className="reaction-emoji-glyph">{f.emoji}</span>
            <span className="reaction-emoji-who">
              <AvatarFace id={f.avatar} size={22} title={f.name} />
              <span className="reaction-emoji-name">{f.name}</span>
            </span>
          </span>
        ))}
      </div>

      <div className={`reaction-fab ${open ? "reaction-fab-open" : ""}`}>
        {open ? (
          <div className="reaction-tray" role="menu" aria-label="Reactions">
            {REACTION_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => tap(emoji)}
                className={`reaction-btn ${bursting === emoji ? "reaction-btn-pop" : ""}`}
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-label={open ? "Close reactions" : "React"}
          onClick={() => setOpen((v) => !v)}
          className="reaction-trigger"
        >
          {open ? "✕" : "😂"}
          <span className="reaction-trigger-label">{open ? "Close" : "React"}</span>
        </button>
      </div>
    </>
  );
}
