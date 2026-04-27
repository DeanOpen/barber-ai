"use client";

import type { Gender, GenerationMode } from "./defaults";

// Showcase-only browser-side history. Mirrors the shop-mode `data/jobs/`
// folder, but lives entirely in localStorage so the public BYOK demo never
// has to round-trip customer photos through this site's server.

export type ShowcaseHistoryItemStatus = "pending" | "running" | "done" | "failed";
export type ShowcaseHistoryItemKind = "single" | "grid";

export type ShowcaseHistoryItem = {
  name: string;
  description: string;
  status: ShowcaseHistoryItemStatus;
  kind: ShowcaseHistoryItemKind;
  b64?: string | null;
  error?: string;
};

export type ShowcaseHistoryEntry = {
  id: string;
  createdAt: number;
  updatedAt: number;
  customerName: string;
  gender: Gender;
  mode: GenerationMode;
  inputDataUrl?: string | null;
  picksCount: number;
  items: ShowcaseHistoryItem[];
};

export const SHOWCASE_HISTORY_KEY = "barber.showcase.history.v1";

// Cap before we even hit a quota error. With image compression (see below)
// each entry shrinks from multi-MB to ~100-300KB so we can comfortably keep
// the most recent 12 inside the typical 5-10MB localStorage budget.
const MAX_ENTRIES = 12;

// Compression targets for stored thumbnails. Output is JPEG so we get an
// order-of-magnitude size reduction over the model's PNG output while still
// looking good in the History drawer and the Slideshow preview.
const THUMB_MAX_EDGE = 1024;
const THUMB_QUALITY = 0.82;
const INPUT_MAX_EDGE = 768;
const INPUT_QUALITY = 0.8;
// Skip compression for already-small data URLs (cheap fast path).
const COMPRESS_THRESHOLD = 60_000;

async function compressDataUrl(
  dataUrl: string | null | undefined,
  maxEdge: number,
  quality: number,
): Promise<string | null | undefined> {
  if (!dataUrl) return dataUrl ?? null;
  if (typeof window === "undefined") return dataUrl;
  if (dataUrl.length < COMPRESS_THRESHOLD) return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image decode failed"));
      el.src = dataUrl;
    });
    const longest = Math.max(img.width, img.height) || maxEdge;
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

// Compress every image attached to a showcase entry. Returns a fresh entry
// so the caller doesn't mutate React state in place.
export async function compressShowcaseEntry(
  entry: ShowcaseHistoryEntry,
): Promise<ShowcaseHistoryEntry> {
  const [inputCompressed, ...itemBlobs] = await Promise.all([
    compressDataUrl(entry.inputDataUrl, INPUT_MAX_EDGE, INPUT_QUALITY),
    ...entry.items.map((it) =>
      compressDataUrl(it.b64, THUMB_MAX_EDGE, THUMB_QUALITY),
    ),
  ]);
  return {
    ...entry,
    inputDataUrl: inputCompressed ?? null,
    items: entry.items.map((it, idx) => ({
      ...it,
      b64: itemBlobs[idx] ?? it.b64 ?? null,
    })),
  };
}

export function readShowcaseHistory(): ShowcaseHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHOWCASE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is ShowcaseHistoryEntry => Boolean(e?.id) && Array.isArray(e?.items))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

function writeRaw(entries: ShowcaseHistoryEntry[]): boolean {
  try {
    window.localStorage.setItem(SHOWCASE_HISTORY_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

// Save what we can. If the browser refuses (quota / disabled), drop the
// oldest entries one at a time until the write succeeds. Final fallback: clear
// the key entirely so we never leave behind a corrupt half-write.
function trySave(entries: ShowcaseHistoryEntry[]): ShowcaseHistoryEntry[] {
  let working = entries.slice(0, MAX_ENTRIES);
  while (working.length > 0) {
    if (writeRaw(working)) return working;
    working = working.slice(0, working.length - 1);
  }
  try {
    window.localStorage.removeItem(SHOWCASE_HISTORY_KEY);
  } catch {
    // ignore - localStorage may be disabled entirely
  }
  return [];
}

export function upsertShowcaseHistory(
  entry: ShowcaseHistoryEntry,
): ShowcaseHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const all = readShowcaseHistory();
  const idx = all.findIndex((e) => e.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  all.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return trySave(all);
}

export function removeShowcaseHistoryEntry(id: string): ShowcaseHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const all = readShowcaseHistory().filter((e) => e.id !== id);
  return trySave(all);
}

export function clearShowcaseHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SHOWCASE_HISTORY_KEY);
  } catch {
    // ignore
  }
}

// Stable, cheap signature used by the home page to decide whether a job has
// changed enough since the last localStorage write to be worth re-persisting.
export function entrySignature(entry: ShowcaseHistoryEntry): string {
  return entry.items
    .map((it) => `${it.name}|${it.status}|${it.b64 ? "y" : "n"}`)
    .join(";");
}
