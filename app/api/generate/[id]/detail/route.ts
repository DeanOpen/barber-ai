import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { appendItem, getJob, rehydrateJob, reopenJob } from "@/lib/jobs";
import { runItem } from "@/lib/generate-runner";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_DETAILS_PER_JOB = 4;

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

    const pick = entry.job.picks.find((p) => p.name === name);
    if (!pick) {
      return NextResponse.json({ error: "Style not in job" }, { status: 404 });
    }

    const detailCount = entry.job.items.filter(
      (it) => it.kind !== "grid",
    ).length;
    if (detailCount >= MAX_DETAILS_PER_JOB) {
      return NextResponse.json(
        { error: `You can render at most ${MAX_DETAILS_PER_JOB} detail looks per session` },
        { status: 429 },
      );
    }

    const existingIdx = entry.job.items.findIndex(
      (it) => it.kind !== "grid" && it.name === name,
    );
    if (existingIdx >= 0 && entry.job.items[existingIdx].status === "running") {
      return NextResponse.json({ error: "Already generating" }, { status: 409 });
    }

    const settings = await getSettings();
    if (!settings.apiKey) {
      return NextResponse.json({ error: "Kiosk not configured" }, { status: 400 });
    }

    await reopenJob(id);

    const index = await appendItem(id, {
      name: pick.name,
      description: pick.description,
      status: "pending",
      kind: "single",
    });
    if (index === null) {
      return NextResponse.json({ error: "Could not append item" }, { status: 500 });
    }

    runItem({ jobId: id, index, settings }).catch((err) => {
      console.error("[detail] runner failed", err);
    });

    return NextResponse.json({ ok: true, index });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[detail]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
