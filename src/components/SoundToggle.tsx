"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted, sfx, unlockAudio } from "@/lib/sfx";

export default function SoundToggle() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  return (
    <button
      type="button"
      className="btn-ghost rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
      onClick={() => {
        if (!muted) {
          // Turning sound OFF — stay silent.
          setMuted(true);
          setMutedState(true);
          return;
        }
        // Turning sound ON — unlock + confirmation beep only.
        setMuted(false);
        setMutedState(false);
        unlockAudio();
        sfx.test();
      }}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      title={muted ? "Sound is off — tap to turn on" : "Sound is on — tap to mute"}
    >
      {muted ? "🔇 Muted" : "🔊 Sound on"}
    </button>
  );
}
