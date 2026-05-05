import sharp from "sharp";
import type { Watermark } from "./settings";
import { resolveGridShape, type PromptStyle } from "./prompts";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function truncateLine(line: string, maxChars: number): string {
  if (line.length <= maxChars) return line;
  if (maxChars <= 3) return line.slice(0, maxChars);
  return `${line.slice(0, maxChars - 3).trimEnd()}...`;
}

function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === 0) lines.push(text);

  const extraWords = words.join(" ").length > lines.join(" ").length;
  if (extraWords && lines.length > 0) {
    lines[lines.length - 1] = truncateLine(lines[lines.length - 1], maxChars);
  }
  return lines.slice(0, maxLines).map((line) => truncateLine(line, maxChars));
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

// The image models are unreliable at typography. For grid lookbooks, draw the
// selected style names ourselves so save/present output always carries the same
// style order that the prompt used.
export async function applyGridLabels(
  pngBuffer: Buffer,
  styles: PromptStyle[],
): Promise<Buffer> {
  if (styles.length === 0) return pngBuffer;
  try {
    const meta = await sharp(pngBuffer).metadata();
    const w = meta.width ?? 1024;
    const h = meta.height ?? 1024;
    const { cols, rows } = resolveGridShape(styles.length);
    if (rows <= 0) return pngBuffer;

    const cellW = w / cols;
    const cellH = h / rows;
    const fontSize = Math.round(clamp(Math.min(cellW * 0.072, cellH * 0.052), 12, 28));
    const lineHeight = Math.round(fontSize * 1.15);
    const padX = Math.max(8, Math.round(fontSize * 0.65));
    const padY = Math.max(6, Math.round(fontSize * 0.45));
    const maxChars = Math.max(8, Math.floor((cellW - padX * 2) / (fontSize * 0.54)));

    const labels = styles
      .map((style, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = col * cellW;
        const y = row * cellH;
        const lines = wrapLabel(`${i + 1}. ${style.name}`, maxChars, 2);
        const plateH = Math.min(
          Math.round(cellH * 0.32),
          Math.round(lines.length * lineHeight + padY * 2),
        );
        const plateY = y + cellH - plateH;
        const centerX = x + cellW / 2;
        const firstLineY = plateY + padY + fontSize;
        const tspans = lines
          .map(
            (line, lineIndex) =>
              `<tspan x="${centerX.toFixed(2)}" dy="${lineIndex === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
          )
          .join("");
        return `
  <rect x="${(x + 1).toFixed(2)}" y="${plateY.toFixed(2)}" width="${Math.max(1, cellW - 2).toFixed(2)}" height="${plateH.toFixed(2)}" fill="#071014" fill-opacity="0.74" />
  <text x="${centerX.toFixed(2)}" y="${firstLineY.toFixed(2)}" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}" text-anchor="middle" paint-order="stroke fill" stroke="rgba(0,0,0,0.55)" stroke-width="${Math.max(1, fontSize * 0.06).toFixed(2)}">${tspans}</text>`;
      })
      .join("");

    const svg = `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
${labels}
</svg>`.trim();

    return await sharp(pngBuffer)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  } catch (err) {
    console.error("[grid-labels] failed, returning original", err);
    return pngBuffer;
  }
}
