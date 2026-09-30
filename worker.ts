// @ts-ignore generated at build time by OpenNext
import { default as handler } from "./.open-next/worker.js";
export { RoomHub } from "./src/durable-objects/RoomHub";

export default {
  async fetch(
    request: Request,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    // Always handle room WS on the Worker (Assets must not swallow upgrades).
    const wsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws\/?$/i);
    if (wsMatch) {
      const code = decodeURIComponent(wsMatch[1]).toUpperCase();
      const ns = (env as CloudflareEnv & { ROOM_HUB?: DurableObjectNamespace })
        .ROOM_HUB;
      if (!ns) {
        return new Response("Realtime unavailable", { status: 503 });
      }
      const stub = ns.get(ns.idFromName(code));
      return stub.fetch(request);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (handler as any).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
