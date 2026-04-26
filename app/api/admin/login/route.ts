import { NextRequest, NextResponse } from "next/server";
import { login, logout } from "@/lib/auth";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";

// In PUBLIC_SHOWCASE mode there is no admin: this route is closed off so the
// admin password (if any was seeded by env) is unreachable.
function showcaseGate() {
  return NextResponse.json(
    { error: "Admin is disabled in this build (PUBLIC_SHOWCASE)." },
    { status: 410 },
  );
}

export async function POST(req: NextRequest) {
  if (IS_SHOWCASE) return showcaseGate();
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password) return NextResponse.json({ error: "Password required" }, { status: 400 });
  const ok = await login(password);
  if (!ok) return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (IS_SHOWCASE) return showcaseGate();
  await logout();
  return NextResponse.json({ ok: true });
}
