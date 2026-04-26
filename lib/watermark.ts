import sharp from "sharp";
import type { Watermark } from "./settings";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Apply a text watermark to a PNG buffer. Returns the new PNG buffer (raw,
// no base64). On any failure we return the original buffer - watermarking is
// never allowed to break image delivery.
export async function applyWatermark(
  pngBuffer: Buffer,
  wm: Watermark,
): Promise<Buffer> {
  if (!wm.enabled || !wm.text.trim()) return pngBuffer;
  try {
    const meta = await sharp(pngBuffer).metadata();
    const w = meta.width ?? 1024;
    const h = meta.height ?? 1024;

    const fontSize = Math.max(10, Math.round(w * wm.size));
    // Padding roughly half the font size, capped so it doesn't dominate
    // small renders.
    const pad = Math.max(8, Math.round(fontSize * 0.6));

    let textAnchor: "start" | "middle" | "end" = "end";
    let x = w - pad;
    let y = h - pad;

    switch (wm.position) {
      case "bottom-right":
        textAnchor = "end";
        x = w - pad;
        y = h - pad;
        break;
      case "bottom-left":
        textAnchor = "start";
        x = pad;
        y = h - pad;
        break;
      case "top-right":
        textAnchor = "end";
        x = w - pad;
        y = pad + fontSize;
        break;
      case "top-left":
        textAnchor = "start";
        x = pad;
        y = pad + fontSize;
        break;
      case "bottom-center":
        textAnchor = "middle";
        x = Math.round(w / 2);
        y = h - pad;
        break;
    }

    const text = escapeXml(wm.text);
    const color = wm.color || "#ffffff";
    const opacity = Math.max(0, Math.min(1, wm.opacity));
    // Soft drop shadow improves legibility on both light and dark
    // backgrounds without introducing a heavy plate.
    const svg = `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${Math.max(1, fontSize * 0.06)}" />
      <feOffset dx="0" dy="${Math.max(1, Math.round(fontSize * 0.05))}" result="o" />
      <feComponentTransfer><feFuncA type="linear" slope="0.6" /></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <text
    x="${x}"
    y="${y}"
    fill="${color}"
    fill-opacity="${opacity}"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    font-weight="600"
    font-size="${fontSize}"
    text-anchor="${textAnchor}"
    filter="url(#s)"
    paint-order="stroke fill"
    stroke="rgba(0,0,0,0.35)"
    stroke-width="${Math.max(1, fontSize * 0.04)}"
  >${text}</text>
</svg>`.trim();

    const overlay = Buffer.from(svg);
    return await sharp(pngBuffer)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .png()
      .toBuffer();
  } catch (err) {
    console.error("[watermark] failed, returning original", err);
    return pngBuffer;
  }
}
