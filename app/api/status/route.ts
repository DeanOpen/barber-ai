import { NextResponse } from "next/server";
import { getSettings, publicSettings } from "@/lib/settings";
import { PUBLIC_DEFAULTS } from "@/lib/defaults";
import { IS_SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";

export async function GET() {
  // In PUBLIC_SHOWCASE mode the server has no key, no admin, and never reads
  // data/settings.json. We still respond so the existing healthcheck and the
  // client status probe both succeed - but only with public, static defaults.
  if (IS_SHOWCASE) {
    return NextResponse.json({
      configured: false,
      showcase: true,
      model: PUBLIC_DEFAULTS.model,
      mode: PUBLIC_DEFAULTS.mode,
      imageCount: PUBLIC_DEFAULTS.imageCount,
      size: PUBLIC_DEFAULTS.size,
      quality: PUBLIC_DEFAULTS.quality,
      prompts: PUBLIC_DEFAULTS.prompts,
      categoryImages: PUBLIC_DEFAULTS.categoryImages,
    });
  }

  const s = await getSettings();
  return NextResponse.json({
    configured: Boolean(s.apiKey),
    showcase: false,
    ...publicSettings(s),
  });
}
