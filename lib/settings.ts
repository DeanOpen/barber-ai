import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PUBLIC_DEFAULTS,
  type GenerationMode,
  type Hairstyle,
  type PublicSettings,
  type Watermark,
} from "./defaults";

export type {
  Gender,
  Hairstyle,
  GenerationMode,
  Watermark,
  WatermarkPosition,
} from "./defaults";

export type Settings = PublicSettings & {
  apiKey: string;
  baseURL: string;
  adminPassword: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

const DEFAULTS: Settings = {
  ...PUBLIC_DEFAULTS,
  apiKey: "",
  baseURL: "",
  // Shop kiosks default the watermark on; the public-showcase build flips it
  // off in PUBLIC_DEFAULTS so the BYOK user owns whether to brand the result.
  watermark: { ...PUBLIC_DEFAULTS.watermark, enabled: true },
  adminPassword: process.env.ADMIN_PASSWORD || "change-me",
};

async function ensureFile(): Promise<void> {
  try {
    await fs.access(SETTINGS_PATH);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(DEFAULTS, null, 2), "utf8");
  }
}

function pickStr(saved: string | undefined, fallback: string): string {
  return saved && saved.trim() ? saved : fallback;
}

function migrateHairstyles(
  raw: unknown,
  fallback: Hairstyle[],
): Hairstyle[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  const out: Hairstyle[] = [];
  raw.forEach((entry, i) => {
    if (typeof entry === "string") {
      const desc = entry.trim();
      if (!desc) return;
      out.push({ name: `Style ${i + 1}`, description: desc });
    } else if (entry && typeof entry === "object") {
      const obj = entry as {
        name?: unknown;
        description?: unknown;
        imageUrl?: unknown;
        section?: unknown;
      };
      const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : `Style ${i + 1}`;
      const description = typeof obj.description === "string" ? obj.description.trim() : "";
      const imageUrl = typeof obj.imageUrl === "string" && obj.imageUrl.trim() ? obj.imageUrl.trim() : undefined;
      const section = typeof obj.section === "string" && obj.section.trim() ? obj.section.trim() : undefined;
      if (!description) return;
      const item: Hairstyle = { name, description };
      if (imageUrl) item.imageUrl = imageUrl;
      if (section) item.section = section;
      out.push(item);
    }
  });
  return out.length > 0 ? out : fallback;
}

export async function getSettings(): Promise<Settings> {
  await ensureFile();
  const raw = await fs.readFile(SETTINGS_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<Settings> & {
    prompts?: { man?: unknown; woman?: unknown; kid?: unknown };
  };
  const mode: GenerationMode =
    parsed.mode === "grid" || parsed.mode === "individual" ? parsed.mode : "individual";
  const wmRaw = (parsed as Partial<Settings>).watermark as Partial<Watermark> | undefined;
  const watermark: Watermark = {
    enabled: typeof wmRaw?.enabled === "boolean" ? wmRaw.enabled : DEFAULTS.watermark.enabled,
    text:
      typeof wmRaw?.text === "string" && wmRaw.text.trim()
        ? wmRaw.text
        : DEFAULTS.watermark.text,
    position:
      wmRaw?.position === "bottom-left" ||
      wmRaw?.position === "top-right" ||
      wmRaw?.position === "top-left" ||
      wmRaw?.position === "bottom-center" ||
      wmRaw?.position === "bottom-right"
        ? wmRaw.position
        : DEFAULTS.watermark.position,
    opacity:
      typeof wmRaw?.opacity === "number" && wmRaw.opacity >= 0 && wmRaw.opacity <= 1
        ? wmRaw.opacity
        : DEFAULTS.watermark.opacity,
    size:
      typeof wmRaw?.size === "number" && wmRaw.size > 0 && wmRaw.size <= 0.2
        ? wmRaw.size
        : DEFAULTS.watermark.size,
    color:
      typeof wmRaw?.color === "string" && wmRaw.color.trim()
        ? wmRaw.color
        : DEFAULTS.watermark.color,
  };
  return {
    ...DEFAULTS,
    ...parsed,
    mode,
    watermark,
    prompts: {
      man: migrateHairstyles(parsed.prompts?.man, DEFAULTS.prompts.man),
      woman: migrateHairstyles(parsed.prompts?.woman, DEFAULTS.prompts.woman),
      kid: migrateHairstyles(parsed.prompts?.kid, DEFAULTS.prompts.kid),
    },
    categoryImages: {
      man: pickStr(parsed.categoryImages?.man, DEFAULTS.categoryImages.man),
      woman: pickStr(parsed.categoryImages?.woman, DEFAULTS.categoryImages.woman),
      kid: pickStr(parsed.categoryImages?.kid, DEFAULTS.categoryImages.kid),
    },
  };
}

export async function saveSettings(next: Settings): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf8");
}

export function publicSettings(s: Settings) {
  return {
    model: s.model,
    mode: s.mode,
    imageCount: s.imageCount,
    size: s.size,
    quality: s.quality,
    prompts: s.prompts,
    categoryImages: s.categoryImages,
  };
}
