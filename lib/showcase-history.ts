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

// Cap before we even hit a quota error. Each individual-mode entry can be
// 4-6MB of base64 image data, so anything above ~12 will reliably blow past
// the typical 5-10MB localStorage budget.
const MAX_ENTRIES = 12;

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
