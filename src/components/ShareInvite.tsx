"use client";

import { useEffect, useState } from "react";

/** Prominent invite while a room is short on players — never a greyed dead-end. */
export default function ShareInvite({
  code,
  copied,
  onCopy,
  need = 1,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
  /** How many more players needed to start. */
  need?: number;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 900);
    return () => window.clearInterval(id);
  }, []);

  const dots = ".".repeat((tick % 3) + 1);

  return (
    <div className="share-invite animate-rise">
      <p className="share-invite-kicker">Waiting for a friend{dots}</p>
      <p className="share-invite-title">Share this code</p>
      <p className="share-invite-code">{code}</p>
      <p className="share-invite-sub">
        Need {need} more player{need === 1 ? "" : "s"}. Same link, paste the
        code, play.
      </p>
      <button
        type="button"
        onClick={onCopy}
        className="dopamine-roll share-invite-btn mt-4 w-full rounded-2xl px-4 py-3.5 text-base font-extrabold"
      >
        {copied ? "Copied — now send it" : "Copy code & share"}
      </button>
    </div>
  );
}
