"use client";

import type { Watermark } from "./defaults";
import { resolveGridShape, type PromptStyle } from "./prompts";

// Browser-side watermark using <canvas>. Mirrors the server-side helper in
// lib/watermark.ts (which uses sharp + SVG) but stays dependency-free so the
// public showcase build can do it entirely in the user's browser.
//
// Returns a base64 PNG (no `data:` prefix). If anything fails - bad input,
// canvas unavailable, OOM - we return the original base64 so a watermark hiccup
// never costs the user the rendered look.
export async function applyWatermarkClient(
  b64Png: string,
  wm: Watermark,
): Promise<string> {
  if (!wm.enabled || !wm.text || !wm.text.trim()) return b64Png;

  try {
    const blob = await base64ToBlob(b64Png, "image/png");
    const bitmap = await loadBitmap(blob);
    const w = bitmap.width;
    const h = bitmap.height;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return b64Png;

    ctx.drawImage(bitmap, 0, 0, w, h);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const fontSize = Math.max(10, Math.round(w * clamp(wm.size, 0.005, 0.2)));
    const pad = Math.max(8, Math.round(fontSize * 0.6));
    const opacity = clamp(wm.opacity, 0, 1);
    const color = wm.color || "#ffffff";

    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
    ctx.textBaseline = "alphabetic";

    let textAlign: CanvasTextAlign = "right";
    let x = w - pad;
    let y = h - pad;
    switch (wm.position) {
      case "bottom-right":
        textAlign = "right";
        x = w - pad;
        y = h - pad;
        break;
      case "bottom-left":
        textAlign = "left";
        x = pad;
        y = h - pad;
        break;
      case "top-right":
        textAlign = "right";
        x = w - pad;
        y = pad + fontSize;
        break;
      case "top-left":
        textAlign = "left";
        x = pad;
        y = pad + fontSize;
        break;
      case "bottom-center":
        textAlign = "center";
        x = Math.round(w / 2);
        y = h - pad;
        break;
    }
    ctx.textAlign = textAlign;

    // Soft drop shadow for legibility on light or dark backgrounds.
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = Math.max(2, fontSize * 0.12);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.05));

    // Stroke first (under fill) - gives the same paint-order: stroke fill we
    // get from the server SVG.
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, fontSize * 0.08);
    ctx.strokeStyle = `rgba(0,0,0,${0.55 * opacity})`;
    ctx.strokeText(wm.text, x, y);

    ctx.shadowColor = "transparent";
    ctx.fillStyle = withAlpha(color, opacity);
    ctx.fillText(wm.text, x, y);

    const out = await canvasToBase64Png(canvas);
    return out || b64Png;
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[client-watermark] failed, returning original", err);
    }
    return b64Png;
  }
}

// Browser-side grid labels. This is intentionally app-rendered instead of
// prompt-rendered because image models often omit or garble text.
export async function applyGridLabelsClient(
  b64Png: string,
  styles: PromptStyle[],
): Promise<string> {
  if (styles.length === 0) return b64Png;

  try {
    const blob = await base64ToBlob(b64Png, "image/png");
    const bitmap = await loadBitmap(blob);
    const w = bitmap.width;
    const h = bitmap.height;
    const { cols, rows } = resolveGridShape(styles.length);
    if (rows <= 0) return b64Png;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return b64Png;

    ctx.drawImage(bitmap, 0, 0, w, h);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const cellW = w / cols;
    const cellH = h / rows;
    const fontSize = Math.round(clamp(Math.min(cellW * 0.072, cellH * 0.052), 12, 28));
    const lineHeight = Math.round(fontSize * 1.15);
    const padX = Math.max(8, Math.round(fontSize * 0.65));
    const padY = Math.max(6, Math.round(fontSize * 0.45));

    ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, fontSize * 0.08);

    styles.forEach((style, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = col * cellW;
      const y = row * cellH;
      const maxTextWidth = Math.max(20, cellW - padX * 2);
      const lines = wrapCanvasLabel(ctx, `${i + 1}. ${style.name}`, maxTextWidth, 2);
      const plateH = Math.min(
        Math.round(cellH * 0.32),
        Math.round(lines.length * lineHeight + padY * 2),
      );
      const plateY = y + cellH - plateH;
      const centerX = x + cellW / 2;

      ctx.fillStyle = "rgba(7, 16, 20, 0.74)";
      ctx.fillRect(x + 1, plateY, Math.max(1, cellW - 2), plateH);

      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = Math.max(2, fontSize * 0.08);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.04));

      lines.forEach((line, lineIndex) => {
        const lineY = plateY + padY + fontSize + lineIndex * lineHeight;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.strokeText(line, centerX, lineY);
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(line, centerX, lineY);
        ctx.shadowColor = "rgba(0,0,0,0.5)";
      });
      ctx.shadowColor = "transparent";
    });

    const out = await canvasToBase64Png(canvas);
    return out || b64Png;
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[client-grid-labels] failed, returning original", err);
    }
    return b64Png;
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function truncateMeasured(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const suffix = "...";
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const next = `${text.slice(0, mid).trimEnd()}${suffix}`;
    if (ctx.measureText(next).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${text.slice(0, low).trimEnd()}${suffix}`;
}

function wrapCanvasLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === 0) lines.push(text);

  const usedText = lines.join(" ");
  if (usedText.length < text.length && lines.length > 0) {
    lines[lines.length - 1] = truncateMeasured(ctx, lines[lines.length - 1], maxWidth);
  }
  return lines.slice(0, maxLines).map((line) => truncateMeasured(ctx, line, maxWidth));
}

function withAlpha(color: string, alpha: number): string {
  if (alpha >= 0.999) return color;
  // Translate "#rgb" / "#rrggbb" / "#rrggbbaa" / named to rgba via canvas.
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return color;
  probe.fillStyle = color;
  const computed = probe.fillStyle;
  if (typeof computed === "string" && computed.startsWith("#")) {
    const hex = computed.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // rgb(...) form - splice an alpha in.
  const m = /^rgba?\(([^)]+)\)$/i.exec(computed);
  if (m) {
    const parts = m[1].split(",").map((s) => s.trim()).slice(0, 3);
    if (parts.length === 3) return `rgba(${parts.join(", ")}, ${alpha})`;
  }
  return color;
}

async function base64ToBlob(b64: string, mime: string): Promise<Blob> {
  const clean = b64.replace(/^data:[^,]+,/, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function canvasToBase64Png(canvas: HTMLCanvasElement): Promise<string | null> {
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) return null;
  const buf = await blob.arrayBuffer();
  return arrayBufferToBase64(buf);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
