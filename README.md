# CrossCut

A no-accounts multiplayer browser game hub. Create a room, share a code, pick a game, and play with friends anywhere.

**Live:** [https://crosscut.crosscut-games.workers.dev](https://crosscut.crosscut-games.workers.dev)

## Features

- **No accounts, no installs** — open the site, name yourself, share a room code
- **Five games**
  - Snakes & Ladders (2–6)
  - Tic Tac Toe (2)
  - Dice Duel (2–6)
  - Connect Four (2)
  - RPS Duel (2)
- **Realtime sync** — Durable Object + WebSocket push (HTTP poll fallback)
- **Table chat** — floating messages + saved history
- **Reactions** — emoji float-ups during play
- **Light / dark theme** — lobby and in-game
- **Rematch & leave** — keep the streak going until someone dips

## Stack

- [Next.js](https://nextjs.org) App Router + TypeScript + Tailwind CSS
- [Cloudflare Workers](https://workers.cloudflare.com) via [OpenNext](https://opennext.js.org/cloudflare)
- Cloudflare KV (`ROOMS`) + Durable Object (`ROOM_HUB`)

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Note: Durable Objects are not fully available under plain `next dev`. For the full realtime path locally, use Cloudflare preview:

```bash
npm run preview
```

## Deploy

```bash
npm run deploy
```

Requires Wrangler auth and bindings for KV + Durable Objects (see `wrangler.jsonc`).

## Project layout

```
src/app/                 # App Router pages + API routes
src/components/          # Game UIs, chat, reactions, lobby pieces
src/lib/                 # Game logic, rooms, theme, avatars
src/durable-objects/     # RoomHub (storage + WebSockets)
worker.ts                # Custom Worker entry (WS + OpenNext)
wrangler.jsonc           # Cloudflare bindings
```

## License

Private project — made by Jitin.
