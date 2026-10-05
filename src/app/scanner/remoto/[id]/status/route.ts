import { cookies } from "next/headers";

import { getPairingForMobileUser } from "@/data/scanner";
import { pairingCookieName } from "@/lib/pairing";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const token = (await cookies()).get(pairingCookieName(id))?.value;
  if (!token || !await getPairingForMobileUser(session.user.id, id, token)) {
    return new Response("No encontrado", { status: 404 });
  }

  const encoder = new TextEncoder();
  let stopped = false;
  let ticks = 0;
  const stream = new ReadableStream({
    start(controller) {
      const pump = async () => {
        if (stopped) return;
        try {
          const pairing = await getPairingForMobileUser(session.user.id, id, token);
          if (!pairing) {
            controller.enqueue(encoder.encode(`event: ended\ndata: {}\n\n`));
            stopped = true;
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(`event: ready\ndata: {}\n\n: conectado ${Date.now()}\n\n`));
          ticks += 1;
          if (ticks >= 25) {
            stopped = true;
            controller.close();
            return;
          }
          setTimeout(() => void pump(), 1_000);
        } catch {
          if (!stopped) {
            stopped = true;
            controller.close();
          }
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
