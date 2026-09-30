"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PublicRoom, RoomChat, Slot } from "@/lib/game";
import { colorFor } from "@/lib/theme";
import { sfx } from "@/lib/sfx";
import AvatarFace from "./AvatarFace";

type Floater = {
  key: string;
  text: string;
  name: string;
  avatar: string;
  slot: Slot;
  mine: boolean;
  left: number;
  drift: number;
  delay: number;
};

function spawnFromChat(c: RoomChat, myId: string): Floater {
  return {
    key: `${c.id}-${Math.random().toString(36).slice(2, 6)}`,
    text: c.text,
    name: c.playerId === myId ? "You" : c.name,
    avatar: c.avatar || "luffy",
    slot: c.slot,
    mine: c.playerId === myId,
    left: 12 + Math.random() * 76,
    drift: -40 + Math.random() * 80,
    delay: Math.random() * 0.15,
  };
}

export default function ChatPanel({
  room,
  myId,
  disabled,
  onSend,
}: {
  room: PublicRoom;
  myId: string;
  disabled?: boolean;
  onSend: (text: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const [badge, setBadge] = useState(0);
  const chats = room.chats ?? [];

  useEffect(() => {
    if (seen.current.size === 0 && chats.length) {
      for (const c of chats) seen.current.add(c.id);
    }
  }, [room.code, chats]);

  useEffect(() => {
    const fresh: Floater[] = [];
    let otherCount = 0;
    for (const c of chats) {
      if (seen.current.has(c.id)) continue;
      seen.current.add(c.id);
      // Own messages already floated optimistically on send.
      if (c.playerId === myId) continue;
      otherCount += 1;
      fresh.push(spawnFromChat(c, myId));
    }
    if (!fresh.length) return;
    if (!open && otherCount > 0) {
      setBadge((b) => Math.min(b + otherCount, 9));
    }
    setFloaters((prev) => [...prev, ...fresh].slice(-24));
  }, [chats, myId, open]);

  useEffect(() => {
    if (!open) return;
    setBadge(0);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [chats.length, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || disabled) return;
    const me = room.players.find((p) => p.id === myId);
    setSending(true);
    try {
      sfx.click();
      setFloaters((prev) =>
        [
          ...prev,
          spawnFromChat(
            {
              id: `local-${Date.now()}`,
              playerId: myId,
              name: me?.name ?? "You",
              slot: me?.slot ?? 0,
              avatar: me?.avatar || "luffy",
              text,
              at: Date.now(),
            },
            myId,
          ),
        ].slice(-24),
      );
      setDraft("");
      await onSend(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function prune(key: string) {
    setFloaters((prev) => prev.filter((f) => f.key !== key));
  }

  return (
    <>
      <div className="chat-stage" aria-live="polite">
        {floaters.map((f) => (
          <span
            key={f.key}
            className={`chat-float ${f.mine ? "chat-float-mine" : ""}`}
            style={
              {
                left: `${f.left}%`,
                "--drift": `${f.drift}px`,
                animationDelay: `${f.delay}s`,
              } as CSSProperties
            }
            onAnimationEnd={() => prune(f.key)}
          >
            <span className="chat-float-bubble">
              <span className="chat-float-text">{f.text}</span>
            </span>
            <span className="chat-float-who">
              <AvatarFace id={f.avatar} size={22} title={f.name} />
              <span
                className="chat-float-name"
                style={{ color: colorFor(f.slot) }}
              >
                {f.name}
              </span>
            </span>
          </span>
        ))}
      </div>

      <div className="chat-dock">
        {open ? (
          <div className="chat-panel animate-rise">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-dim">
                Table chat
              </p>
              <button
                type="button"
                className="btn-ghost rounded-lg px-2 py-1 text-[11px] font-semibold"
                onClick={() => {
                  sfx.click();
                  setOpen(false);
                }}
              >
                Hide
              </button>
            </div>

            <div ref={scroller} className="chat-log">
              {chats.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-dim">
                  No messages yet — say hi.
                </p>
              ) : (
                chats.map((c: RoomChat) => (
                  <div
                    key={c.id}
                    className={`chat-line ${c.playerId === myId ? "chat-mine" : ""}`}
                  >
                    <AvatarFace id={c.avatar} size={22} title={c.name} />
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[10px] font-semibold"
                        style={{ color: colorFor(c.slot) }}
                      >
                        {c.playerId === myId ? "You" : c.name}
                      </p>
                      <p className="break-words text-sm leading-snug">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              className="chat-composer mt-2"
              onSubmit={(e) => void submit(e)}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={140}
                placeholder="Say something…"
                disabled={disabled || sending}
                className="chat-composer-input"
                enterKeyHint="send"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={disabled || sending || !draft.trim()}
                className="chat-composer-send"
              >
                Send
              </button>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          className="chat-fab"
          aria-label={open ? "Hide chat" : "Open chat"}
          aria-expanded={open}
          onClick={() => {
            sfx.click();
            setOpen((v) => !v);
            if (!open) setBadge(0);
          }}
        >
          Chat
          {badge > 0 && !open ? (
            <span className="chat-badge">{badge}</span>
          ) : null}
        </button>
      </div>
    </>
  );
}
