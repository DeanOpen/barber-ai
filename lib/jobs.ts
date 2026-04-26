import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import type { Gender, Hairstyle } from "./settings";

export type JobItemStatus = "pending" | "running" | "done" | "failed";
export type JobItemKind = "single" | "grid";

export type JobItem = {
  name: string;
  description: string;
  status: JobItemStatus;
  b64?: string | null;
  error?: string;
  kind?: JobItemKind;
  gridStyles?: { name: string; description: string }[];
};

export type JobMode = "individual" | "grid";

export type Job = {
  id: string;
  createdAt: number;
  updatedAt: number;
  gender: Gender;
  mode: JobMode;
  picks: { name: string; description: string }[];
  items: JobItem[];
  done: boolean;
};

export type JobEvent =
  | { type: "snapshot"; job: Job }
  | { type: "item"; index: number; item: JobItem }
  | { type: "done"; job: Job }
  | { type: "ping" };

type JobEntry = {
  job: Job;
  bus: EventEmitter;
  image: Buffer;
  imageMime: string;
};

export const JOBS_DIR = path.join(process.cwd(), "data", "jobs");

// Pinned on globalThis so `next dev` HMR - which reloads this module on every
// file save - doesn't drop the in-flight job map and orphan the fire-and-forget
// runner. Without this, mid-flight items appear as "Server restarted" on the
// next reconnect even though the Node process never actually restarted.
const memory: Map<string, JobEntry> = ((): Map<string, JobEntry> => {
  const g = globalThis as { __barberJobs__?: Map<string, JobEntry> };
  if (!g.__barberJobs__) g.__barberJobs__ = new Map();
  return g.__barberJobs__;
})();

// Memory: cleared aggressively so a long-running kiosk doesn't balloon RAM.
// Disk: retained much longer so the shop owner can browse history in admin.
const MEMORY_TTL_MS = 60 * 60 * 1000;
const DISK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function newJobId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function jobDir(id: string): Promise<string> {
  const dir = path.join(JOBS_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function persist(job: Job): Promise<void> {
  job.updatedAt = Date.now();
  const dir = await jobDir(job.id);
  await fs.writeFile(path.join(dir, "state.json"), JSON.stringify(job));
}

export async function createJob(args: {
  gender: Gender;
  picks: Hairstyle[];
  mode: JobMode;
  image: Buffer;
  imageMime: string;
}): Promise<JobEntry> {
  const id = newJobId();
  const now = Date.now();
  const picksList = args.picks.map((p) => ({ name: p.name, description: p.description }));
  const items: JobItem[] =
    args.mode === "grid"
      ? [
          {
            name: "Style grid",
            description: `Side-by-side preview of ${picksList.length} looks`,
            status: "pending" as JobItemStatus,
            kind: "grid",
            gridStyles: picksList,
          },
        ]
      : args.picks.map((p) => ({
          name: p.name,
          description: p.description,
          status: "pending" as JobItemStatus,
          kind: "single" as JobItemKind,
        }));
  const job: Job = {
    id,
    createdAt: now,
    updatedAt: now,
    gender: args.gender,
    mode: args.mode,
    picks: picksList,
    items,
    done: false,
  };
  const bus = new EventEmitter();
  bus.setMaxListeners(20);
  const entry: JobEntry = { job, bus, image: args.image, imageMime: args.imageMime };
  memory.set(id, entry);
  const dir = await jobDir(id);
  await fs.writeFile(path.join(dir, "input.bin"), args.image);
  await fs.writeFile(
    path.join(dir, "input.meta.json"),
    JSON.stringify({ mime: args.imageMime }),
  );
  await persist(job);
  return entry;
}

export function getJob(id: string): JobEntry | undefined {
  return memory.get(id);
}

// On server restart we lose in-memory entries. Try to rehydrate from disk so
// at least the snapshot replays - items still "running" become "failed".
export async function rehydrateJob(id: string): Promise<JobEntry | null> {
  const existing = memory.get(id);
  if (existing) return existing;
  const dir = path.join(JOBS_DIR, id);
  if (!existsSync(dir)) return null;
  try {
    const job = JSON.parse(
      await fs.readFile(path.join(dir, "state.json"), "utf8"),
    ) as Job;
    if (job.mode !== "grid" && job.mode !== "individual") job.mode = "individual";
    if (!Array.isArray(job.picks)) {
      job.picks = job.items
        .filter((it) => it.kind !== "grid")
        .map((it) => ({ name: it.name, description: it.description }));
    }
    const meta = JSON.parse(
      await fs.readFile(path.join(dir, "input.meta.json"), "utf8"),
    ) as { mime: string };
    const image = await fs.readFile(path.join(dir, "input.bin"));
    let mutated = false;
    for (const item of job.items) {
      if (item.status === "running" || item.status === "pending") {
        item.status = "failed";
        item.error = item.error ?? "Server restarted while this look was generating";
        mutated = true;
      }
    }
    if (mutated) {
      job.done = true;
    }
    const bus = new EventEmitter();
    bus.setMaxListeners(20);
    const entry: JobEntry = { job, bus, image, imageMime: meta.mime };
    memory.set(id, entry);
    if (mutated) await persist(job);
    return entry;
  } catch {
    return null;
  }
}

export async function appendItem(
  id: string,
  item: JobItem,
): Promise<number | null> {
  const entry = memory.get(id);
  if (!entry) return null;
  if (entry.job.items.some((it) => it.name === item.name && it.kind !== "grid")) {
    return entry.job.items.findIndex((it) => it.name === item.name && it.kind !== "grid");
  }
  const idx = entry.job.items.length;
  entry.job.items.push(item);
  if (entry.job.done) entry.job.done = false;
  await persist(entry.job);
  entry.bus.emit("event", {
    type: "item",
    index: idx,
    item: entry.job.items[idx],
  } satisfies JobEvent);
  return idx;
}

export async function setItemStatus(
  id: string,
  index: number,
  patch: Partial<JobItem>,
): Promise<void> {
  const entry = memory.get(id);
  if (!entry) return;
  entry.job.items[index] = { ...entry.job.items[index], ...patch };
  await persist(entry.job);
  entry.bus.emit("event", {
    type: "item",
    index,
    item: entry.job.items[index],
  } satisfies JobEvent);
}

export async function maybeFinish(id: string): Promise<void> {
  const entry = memory.get(id);
  if (!entry || entry.job.done) return;
  const allSettled = entry.job.items.every(
    (i) => i.status === "done" || i.status === "failed",
  );
  if (!allSettled) return;
  entry.job.done = true;
  await persist(entry.job);
  entry.bus.emit("event", { type: "done", job: entry.job } satisfies JobEvent);
}

export async function reopenJob(id: string): Promise<void> {
  const entry = memory.get(id);
  if (!entry) return;
  if (entry.job.done) {
    entry.job.done = false;
    await persist(entry.job);
  }
}

// Ad-hoc reaper. Memory entries are dropped after MEMORY_TTL_MS so RAM stays
// flat on a long-running kiosk. Disk artifacts are kept for DISK_TTL_MS so
// the shop owner can browse the History tab.
export async function reapOldJobs(): Promise<void> {
  const memCutoff = Date.now() - MEMORY_TTL_MS;
  const diskCutoff = Date.now() - DISK_TTL_MS;
  for (const [id, entry] of memory) {
    if (entry.job.updatedAt < memCutoff) memory.delete(id);
  }
  try {
    const ids = await fs.readdir(JOBS_DIR);
    await Promise.all(
      ids.map(async (id) => {
        const dir = path.join(JOBS_DIR, id);
        try {
          const stat = await fs.stat(dir);
          if (stat.mtimeMs < diskCutoff) {
            await fs.rm(dir, { recursive: true, force: true });
          }
        } catch {
          // ignore
        }
      }),
    );
  } catch {
    // dir doesn't exist yet
  }
}
