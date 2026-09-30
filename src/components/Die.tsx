"use client";

import { useEffect, useState } from "react";

/**
 * Standard Western die pip map on a 3×3 grid:
 *  1 2 3
 *  4 5 6
 *  7 8 9
 */
const PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export default function Die({
  value,
  rollId,
  className = "",
  showNumber = true,
  size = "md",
}: {
  value: number | null;
  rollId: number;
  className?: string;
  showNumber?: boolean;
  size?: "md" | "lg";
}) {
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState<number | null>(
    value && value >= 1 && value <= 6 ? value : null,
  );

  useEffect(() => {
    if (!value || value < 1 || value > 6) {
      setDisplay(null);
      setSpinning(false);
      return;
    }

    // Fresh roll → spin through faces, then land.
    setSpinning(true);
    let step = 0;
    const flash = window.setInterval(() => {
      setDisplay((Math.floor(Math.random() * 6) + 1) as number);
      step += 1;
      if (step >= 8) {
        window.clearInterval(flash);
        setDisplay(value);
        setSpinning(false);
      }
    }, 55);

    return () => window.clearInterval(flash);
  }, [rollId, value]);

  const face = display && display >= 1 && display <= 6 ? display : null;
  const pips = face ? PIPS[face] : [];
  const idle = !face && !spinning;

  return (
    <div
      className={`die-wrap ${size === "lg" ? "die-wrap-lg" : ""} ${className}`.trim()}
    >
      <div
        key={spinning ? `spin-${rollId}` : `land-${rollId}-${face ?? 0}`}
        className={`die-face ${
          spinning
            ? "animate-die-spin"
            : face
              ? "animate-tumble"
              : "die-face-idle"
        }`}
        role="img"
        aria-label={face ? `Rolled ${face}` : "Ready to roll"}
      >
        {idle ? (
          <span className="die-idle-mark">?</span>
        ) : (
          Array.from({ length: 9 }, (_, i) => {
            const on = pips.includes(i + 1);
            return (
              <span
                key={i}
                className={on ? "pip pip-on" : "pip pip-off"}
                aria-hidden="true"
              />
            );
          })
        )}
      </div>
      {showNumber ? (
        <p
          className={`die-number ${spinning || idle ? "text-dim" : ""}`}
          aria-hidden={face ? undefined : true}
        >
          {spinning ? "…" : idle ? "ready" : face}
        </p>
      ) : null}
    </div>
  );
}
