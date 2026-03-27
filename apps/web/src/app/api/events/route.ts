export const dynamic = "force-dynamic";

/**
 * SSE endpoint for entity change notifications.
 *
 * With PGlite, this used pg_notify. With SQLite, real-time notifications
 * are not natively available. For now, this endpoint provides a heartbeat
 * stream that clients can use to trigger periodic re-fetches.
 *
 * NATS-based event propagation is the primary notification mechanism
 * for the Baker Street platform (handled at the extension layer).
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "connected" })}\n\n`
          )
        );
      } catch {
        // Client disconnected
      }

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
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
