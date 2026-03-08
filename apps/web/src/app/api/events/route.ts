import { getPgliteClient } from "@baker-street/db/client";

export const dynamic = "force-dynamic";

type Listener = (payload: string) => void;
const listeners = new Set<Listener>();
let listenerReady: Promise<void> | null = null;

function ensureListener() {
  if (listenerReady) return listenerReady;
  const pg = getPgliteClient();
  listenerReady = pg
    .listen("entity_change", (payload) => {
      for (const fn of listeners) {
        fn(payload);
      }
    })
    .then(() => {});
  return listenerReady;
}

export async function GET(request: Request) {
  try {
    await ensureListener();
  } catch {
    return new Response("PGlite not initialized", { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          listeners.delete(send);
        }
      };

      listeners.add(send);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          listeners.delete(send);
        }
      }, 30_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        listeners.delete(send);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
