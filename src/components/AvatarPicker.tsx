"use client";

import { AVATARS, type AvatarId } from "@/lib/avatars";
import AvatarFace from "./AvatarFace";

export default function AvatarPicker({
  value,
  onChange,
}: {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
}) {
  const males = AVATARS.filter((a) => a.gender === "male");
  const females = AVATARS.filter((a) => a.gender === "female");

  return (
    <div className="mt-5">
      <span className="mb-2 block text-[0.7rem] uppercase tracking-[0.18em] text-dim">
        Pick your fighter
      </span>
      <div className="space-y-3">
        {[males, females].map((group, gi) => (
          <div key={gi} className="flex flex-wrap gap-2">
            {group.map((a) => {
              const selected = value === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onChange(a.id)}
                  className={`avatar-pick ${selected ? "avatar-pick-on" : ""}`}
                  aria-pressed={selected}
                  aria-label={a.name}
                  title={a.name}
                >
                  <AvatarFace id={a.id} size={48} title={a.name} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
