import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { JOBS_DIR, type Job, type JobItem } from "./jobs";

export type HistoryItemSummary = {
  index: number;
  name: string;
  description: string;
  status: JobItem["status"];
  kind: JobItem["kind"];
  hasImage: boolean;
};

export type HistoryEntry = {
  id: string;
  createdAt: number;
  updatedAt: number;
  gender: Job["gender"];
  mode: Job["mode"];
  done: boolean;
  picksCount: number;
  hasInput: boolean;
  inputMime: string | null;
  totalCount: number;
  doneCount: number;
  failedCount: number;
  items: HistoryItemSummary[];
};

async function safeReadJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

// List every persisted job, newest first. Reads the on-disk state.json files
// directly so freshly-restarted servers can still produce the full history.
export async function listHistory(): Promise<HistoryEntry[]> {
  if (!existsSync(JOBS_DIR)) return [];
  let ids: string[];
  try {
    ids = await fs.readdir(JOBS_DIR);
  } catch {
    return [];
  }
  const entries = await Promise.all(
    ids.map(async (id) => {
      const dir = path.join(JOBS_DIR, id);
      const state = await safeReadJson<Job>(path.join(dir, "state.json"));
      if (!state) return null;
      const meta = await safeReadJson<{ mime: string }>(
        path.join(dir, "input.meta.json"),
      );
      const hasInput = existsSync(path.join(dir, "input.bin"));
      const items: HistoryItemSummary[] = (state.items ?? []).map(
        (it, index) => ({
          index,
          name: it.name,
          description: it.description,
          status: it.status,
          kind: it.kind,
          hasImage: it.status === "done" && Boolean(it.b64),
        }),
      );
      const summary: HistoryEntry = {
        id: state.id ?? id,
        createdAt: state.createdAt ?? 0,
        updatedAt: state.updatedAt ?? state.createdAt ?? 0,
        gender: state.gender,
        mode: state.mode,
        done: Boolean(state.done),
        picksCount: Array.isArray(state.picks) ? state.picks.length : 0,
        hasInput,
        inputMime: meta?.mime ?? null,
        totalCount: items.length,
        doneCount: items.filter((it) => it.status === "done").length,
        failedCount: items.filter((it) => it.status === "failed").length,
        items,
      };
      return summary;
    }),
  );
  return entries
    .filter((e): e is HistoryEntry => e !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function readInputImage(
  id: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const dir = path.join(JOBS_DIR, id);
  const meta = await safeReadJson<{ mime: string }>(
    path.join(dir, "input.meta.json"),
  );
  try {
    const buffer = await fs.readFile(path.join(dir, "input.bin"));
    return { buffer, mime: meta?.mime ?? "image/png" };
  } catch {
    return null;
  }
}

export async function readGeneratedImage(
  id: string,
  index: number,
): Promise<Buffer | null> {
  const dir = path.join(JOBS_DIR, id);
  const state = await safeReadJson<Job>(path.join(dir, "state.json"));
  if (!state) return null;
  const item = state.items?.[index];
  if (!item || item.status !== "done" || !item.b64) return null;
  try {
    return Buffer.from(item.b64, "base64");
  } catch {
    return null;
  }
}

export async function deleteHistoryEntry(id: string): Promise<boolean> {
  const dir = path.join(JOBS_DIR, id);
  if (!existsSync(dir)) return false;
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
