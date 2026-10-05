import { getPairingFeedForUser } from "@/data/scanner";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const url = new URL(request.url);
  let cursor = Math.max(0, Number(request.headers.get("last-event-id") ?? url.searchParams.get("after") ?? 0) || 0);
  const initial = await getPairingFeedForUser(session.user.id, id, cursor);
  if (!initial) return new Response("No encontrado", { status: 404 });

  const encoder = new TextEncoder();
  let stopped = false;
  let ticks = 0;
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const pump = async () => {
        if (stopped) return;
        try {
          const feed = ticks === 0 ? initial : await getPairingFeedForUser(session.user.id, id, cursor);
          if (!feed) { stopped = true; controller.close(); return; }
          send(`event: pairing\ndata: ${JSON.stringify(feed.pairing)}\n\n`);
          for (const event of feed.events) {
            cursor = Math.max(cursor, event.sequence);
            send(`id: ${event.sequence}\nevent: scan\ndata: ${JSON.stringify(event)}\n\n`);
          }
          send(`: conectado ${Date.now()}\n\n`);
          ticks += 1;
          if (feed.pairing.status === "REVOKED" || feed.pairing.status === "EXPIRED" || ticks >= 25) {
            stopped = true; controller.close(); return;
          }
          setTimeout(() => void pump(), 1_000);
        } catch {
          if (!stopped) { stopped = true; controller.close(); }
        }
      };
      request.signal.addEventListener("abort", () => { stopped = true; }, { once: true });
      void pump();
    },
    cancel() { stopped = true; },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
