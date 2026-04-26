import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { getJob, rehydrateJob, reopenJob, setItemStatus } from "@/lib/jobs";
import { runItem } from "@/lib/generate-runner";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (IS_SHOWCASE) {
    return NextResponse.json(
      { error: "Disabled in PUBLIC_SHOWCASE build." },
      { status: 410 },
    );
  }
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const entry = getJob(id) ?? (await rehydrateJob(id));
    if (!entry) {
      return NextResponse.json({ error: "Job expired" }, { status: 404 });
    }

    const index = entry.job.items.findIndex((i) => i.name === name);
    if (index < 0) {
      return NextResponse.json({ error: "Style not in job" }, { status: 404 });
    }
    if (entry.job.items[index].status === "running") {
      return NextResponse.json({ error: "Already generating" }, { status: 409 });
    }

    const settings = await getSettings();
    if (!settings.apiKey) {
      return NextResponse.json({ error: "Kiosk not configured" }, { status: 400 });
    }

    // Reopen done jobs so subscribers don't see a stale "done" state.
    await reopenJob(id);
    await setItemStatus(id, index, {
      status: "pending",
      b64: null,
      error: undefined,
    });

    runItem({ jobId: id, index, settings }).catch((err) => {
      console.error("[retry] runner failed", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[retry]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
