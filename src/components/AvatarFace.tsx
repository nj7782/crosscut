"use client";

import { avatarSrc, type AvatarId } from "@/lib/avatars";

export default function AvatarFace({
  id,
  size = 36,
  className = "",
  title,
}: {
  id?: AvatarId | string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSrc(id)}
      alt={title ?? "Avatar"}
      width={size}
      height={size}
      draggable={false}
      className={`avatar-face ${className}`.trim()}
      style={{ width: size, height: size }}
      title={title}
    />
  );
}
