import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";

function showcaseGate() {
  return NextResponse.json(
    { error: "Admin is disabled in this build (PUBLIC_SHOWCASE)." },
    { status: 410 },
  );
}

export async function GET() {
  if (IS_SHOWCASE) return showcaseGate();
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getSettings());
}

export async function POST(req: NextRequest) {
  if (IS_SHOWCASE) return showcaseGate();
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const incoming = (await req.json()) as Partial<Settings>;
  const current = await getSettings();
  const merged: Settings = {
    ...current,
    ...incoming,
    prompts: { ...current.prompts, ...(incoming.prompts || {}) },
  };
  merged.imageCount = Math.min(12, Math.max(1, Number(merged.imageCount) || 4));
  if (!merged.adminPassword) merged.adminPassword = current.adminPassword;
  await saveSettings(merged);
  return NextResponse.json({ ok: true });
}
