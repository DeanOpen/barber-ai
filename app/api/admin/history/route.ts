import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { listHistory } from "@/lib/history";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";

export async function GET() {
  if (IS_SHOWCASE) {
    return NextResponse.json(
      { error: "Admin is disabled in this build (PUBLIC_SHOWCASE)." },
      { status: 410 },
    );
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const entries = await listHistory();
  return NextResponse.json({ entries });
}
