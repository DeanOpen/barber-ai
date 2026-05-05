import { NextRequest, NextResponse } from "next/server";
import { getSettings, type Gender, type Hairstyle } from "@/lib/settings";
import { createJob, reapOldJobs } from "@/lib/jobs";
import { runAllPending } from "@/lib/generate-runner";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";
export const maxDuration = 300;

function showcaseGate() {
  return NextResponse.json(
    {
      error:
        "Server-side kiosk generation is disabled in this build (PUBLIC_SHOWCASE). BYOK generation uses the public showcase flow.",
    },
    { status: 410 },
  );
}

function pickRandom(pool: Hairstyle[], n: number): Hairstyle[] {
  const copy = [...pool];
  const out: Hairstyle[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (IS_SHOWCASE) return showcaseGate();
  try {
    const form = await req.formData();
    const file = form.get("image");
    const gender = (form.get("gender") as Gender) || "man";
    const requested = Number(form.get("count") || 0);
    const stylesRaw = form.getAll("styles").map((s) => String(s)).filter(Boolean);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }
    if (!["man", "woman", "kid"].includes(gender)) {
      return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings.apiKey) {
      return NextResponse.json(
        {
          error:
            "This kiosk isn't configured yet. Ask the shop owner to add an OpenAI API key in Shop admin.",
        },
        { status: 400 },
      );
    }

    const isGrid = settings.mode === "grid";
    const maxPicks = isGrid ? 12 : 6;
    const pool = settings.prompts[gender];
    let picks: Hairstyle[];
    if (stylesRaw.length > 0) {
      const byName = new Map(pool.map((h) => [h.name, h]));
      picks = stylesRaw
        .map((name) => byName.get(name))
        .filter((x): x is Hairstyle => Boolean(x))
        .slice(0, maxPicks);
    } else {
      const count = Math.min(maxPicks, Math.max(1, requested || settings.imageCount));
      picks = pickRandom(pool, count);
    }
    if (picks.length === 0) {
      return NextResponse.json(
        { error: `No prompts configured for ${gender}` },
        { status: 400 },
      );
    }

    // Best-effort cleanup; never fail the request because of it.
    reapOldJobs().catch(() => {});

    const buffer = Buffer.from(await file.arrayBuffer());
    const imageMime = file.type || "image/png";

    const { job } = await createJob({
      gender,
      picks,
      mode: isGrid ? "grid" : "individual",
      image: buffer,
      imageMime,
    });

    // Fire-and-forget: the runner persists progress so connection drops on the
    // client don't lose work. Errors per item are captured into the job state.
    runAllPending({ jobId: job.id, settings }).catch((err) => {
      console.error("[generate] runner failed", err);
    });

    return NextResponse.json({ jobId: job.id, items: job.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
