import { NextRequest } from "next/server";
import { getJob, rehydrateJob, type JobEvent } from "@/lib/jobs";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";
export const maxDuration = 300;

// Cheap existence probe used by the client's resume flow - avoids opening a
// long-lived SSE connection just to find out the job is gone.
export async function HEAD(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (IS_SHOWCASE) return new Response(null, { status: 410 });
  const { id } = await ctx.params;
  const entry = getJob(id) ?? (await rehydrateJob(id));
  return new Response(null, { status: entry ? 200 : 404 });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (IS_SHOWCASE) {
    return new Response(
      JSON.stringify({ error: "Disabled in PUBLIC_SHOWCASE build." }),
      { status: 410, headers: { "Content-Type": "application/json" } },
    );
  }
  const { id } = await ctx.params;
  const entry = getJob(id) ?? (await rehydrateJob(id));
  if (!entry) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: JobEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // controller might already be closed
        }
      };

      // Initial snapshot - gives reconnecting clients full state.
      send({ type: "snapshot", job: entry.job });

      // Heartbeat keeps the connection alive through proxies.
      const heartbeat = setInterval(() => send({ type: "ping" }), 15_000);

      const onEvent = (e: JobEvent) => send(e);
      entry.bus.on("event", onEvent);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        entry.bus.off("event", onEvent);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Close after the job is fully done - but with a small grace period so
      // pending events flush.
      const onDone = (e: JobEvent) => {
        if (e.type === "done") {
          setTimeout(cleanup, 250);
        }
      };
      entry.bus.on("event", onDone);

      // If the job already finished before this connection opened, close soon
      // (snapshot already carried the final state).
      if (entry.job.done) {
        setTimeout(cleanup, 250);
      }

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
