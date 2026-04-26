import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { readGeneratedImage } from "@/lib/history";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; idx: string }> },
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
  const { id, idx } = await ctx.params;
  const index = Number.parseInt(idx, 10);
  if (!Number.isFinite(index) || index < 0) {
    return new NextResponse("Bad index", { status: 400 });
  }
  const buffer = await readGeneratedImage(id, index);
  if (!buffer) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
