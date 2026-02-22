import postgres from "postgres";

export const dynamic = "force-dynamic";

// ---------- singleton LISTEN connection ----------
// One Postgres connection is shared across all SSE clients.
// Each browser tab registers a callback; when it disconnects the
// callback is removed.  The connection is opened lazily on the
// first request and kept alive for the lifetime of the process.

type Listener = (payload: string) => void;

const listeners = new Set<Listener>();

let listenerReady: Promise<void> | null = null;

function ensureListener() {
  if (listenerReady) return listenerReady;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const sql = postgres(url, { max: 1 });

  listenerReady = sql.listen("entity_change", (payload) => {
    for (const fn of listeners) {
      fn(payload);
    }
  }).then(() => {});

  return listenerReady;
}

// ---------- SSE handler ----------

export async function GET(request: Request) {
  try {
    await ensureListener();
  } catch {
    return new Response("DATABASE_URL not set", { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Client already disconnected
          listeners.delete(send);
        }
      };

      listeners.add(send);

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          listeners.delete(send);
        }
      }, 30_000);

      // Clean up on client disconnect
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
