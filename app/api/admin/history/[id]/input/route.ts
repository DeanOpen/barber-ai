import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { readInputImage } from "@/lib/history";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";

export async function GET(
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
  const result = await readInputImage(id);
  if (!result) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": result.mime,
      "Cache-Control": "private, max-age=60",
    },
  });
}
