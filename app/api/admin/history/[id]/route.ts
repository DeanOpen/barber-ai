import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { deleteHistoryEntry } from "@/lib/history";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (IS_SHOWCASE) {
    return NextResponse.json(
      { error: "Admin is disabled in this build (PUBLIC_SHOWCASE)." },
      { status: 410 },
    );
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const ok = await deleteHistoryEntry(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
