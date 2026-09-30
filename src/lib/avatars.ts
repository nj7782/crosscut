export const AVATARS = [
  { id: "luffy", name: "Luffy", gender: "male" as const },
  { id: "naruto", name: "Naruto", gender: "male" as const },
  { id: "gojo", name: "Gojo", gender: "male" as const },
  { id: "levi", name: "Levi", gender: "male" as const },
  { id: "goku", name: "Goku", gender: "male" as const },
  { id: "hyouka", name: "Hyouka", gender: "male" as const },
  { id: "morihito", name: "Morihito", gender: "male" as const },
  { id: "jin", name: "Jin", gender: "male" as const },
  { id: "nami", name: "Nami", gender: "female" as const },
  { id: "hinata", name: "Hinata", gender: "female" as const },
  { id: "makima", name: "Makima", gender: "female" as const },
  { id: "mikasa", name: "Mikasa", gender: "female" as const },
  { id: "zero-two", name: "Zero Two", gender: "female" as const },
  { id: "shioko", name: "Shioko", gender: "female" as const },
  { id: "lumi", name: "Lumi", gender: "female" as const },
  { id: "kae", name: "Kae", gender: "female" as const },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && AVATARS.some((a) => a.id === value);
}

export function avatarSrc(id: AvatarId | string | null | undefined) {
  const safe = isAvatarId(id) ? id : "luffy";
  return `/avatars/${safe}.png`;
}

export function avatarMeta(id: AvatarId | string | null | undefined) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

export const DEFAULT_AVATAR: AvatarId = "luffy";
