"use client";

import type { Gender, Hairstyle, Watermark, GenerationMode } from "./defaults";
import { buildPrompt, buildGridPrompt, type PromptGender } from "./prompts";
import { applyGridLabelsClient, applyWatermarkClient } from "./client-watermark";

// Minimal item shape used by the showcase home-page state. Mirrors the server
// `JobItem` from lib/jobs.ts but lives in the browser only.
export type ClientItemStatus = "pending" | "running" | "done" | "failed";
export type ClientItemKind = "single" | "grid";

export type ClientItem = {
  name: string;
  description: string;
  status: ClientItemStatus;
  kind: ClientItemKind;
  b64?: string | null;
  error?: string;
  gridStyles?: { name: string; description: string }[];
};

export type ClientByokConfig = {
  apiKey: string;
  baseURL: string; // empty string ⇒ default to https://api.openai.com/v1
  model: string;
  size: "auto" | "1024x1024" | "1024x1536" | "1536x1024";
  quality: "auto" | "low" | "medium" | "high";
  watermark: Watermark;
  mode: GenerationMode;
};

export type RunArgs = {
  config: ClientByokConfig;
  gender: Gender;
  picks: Hairstyle[];
  image: File;
  onItem: (index: number, patch: Partial<ClientItem>) => void;
  signal?: AbortSignal;
  concurrency?: number;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export function buildInitialItems(
  picks: Hairstyle[],
  mode: GenerationMode,
): ClientItem[] {
  if (mode === "grid") {
    return [
      {
        name: "Style grid",
        description: `Side-by-side preview of ${picks.length} looks`,
        status: "pending",
        kind: "grid",
        gridStyles: picks.map((p) => ({ name: p.name, description: p.description })),
      },
    ];
  }
  return picks.map((p) => ({
    name: p.name,
    description: p.description,
    status: "pending",
    kind: "single",
  }));
}

export async function runClientJob(args: RunArgs): Promise<void> {
  const { config, gender, picks, image, onItem, signal } = args;
  const concurrency = Math.max(1, Math.min(args.concurrency ?? 3, 6));
  const promptGender: PromptGender = gender === "kid" ? "child" : gender;

  const items: ClientItem[] = buildInitialItems(picks, config.mode);
  const baseURL = (config.baseURL || DEFAULT_BASE_URL).replace(/\/+$/, "");

  // Read the image once into ArrayBuffer + a base64 data URL - both are
  // re-used for every parallel call so the user only pays for one disk read.
  const imageBuffer = await image.arrayBuffer();
  const imageMime = image.type || "image/png";

  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      const item = items[i];
      if (signal?.aborted) {
        onItem(i, { status: "failed", error: "Cancelled", b64: null });
        continue;
      }
      onItem(i, { status: "running", error: undefined });
      try {
        const prompt =
          item.kind === "grid"
            ? buildGridPrompt({
                gender: promptGender,
                styles: item.gridStyles ?? [],
              })
            : buildPrompt({
                gender: promptGender,
                hairstyleName: item.name,
                hairstyleDescription: item.description,
              });
        const rawB64 = await generateOneClient({
          config,
          baseURL,
          prompt,
          imageBuffer,
          imageMime,
          preferLandscape: item.kind === "grid",
          signal,
        });
        const watermarked = await applyWatermarkClient(rawB64, config.watermark);
        const finalB64 =
          item.kind === "grid"
            ? await applyGridLabelsClient(watermarked, item.gridStyles ?? [])
            : watermarked;
        onItem(i, { status: "done", b64: finalB64, error: undefined });
      } catch (err) {
        if (signal?.aborted) {
          onItem(i, { status: "failed", error: "Cancelled", b64: null });
          continue;
        }
        const message = err instanceof Error ? err.message : String(err);
        onItem(i, { status: "failed", error: message, b64: null });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function generateOneClient(args: {
  config: ClientByokConfig;
  baseURL: string;
  prompt: string;
  imageBuffer: ArrayBuffer;
  imageMime: string;
  preferLandscape: boolean;
  signal?: AbortSignal;
}): Promise<string> {
  const { config, baseURL, prompt, imageBuffer, imageMime, preferLandscape, signal } = args;
  const useChatModalities = config.model.includes("/");

  if (shouldUseSameOriginProviderProxy(baseURL)) {
    return generateOneViaProxy({
      config,
      baseURL,
      prompt,
      imageBuffer,
      imageMime,
      preferLandscape,
      signal,
    });
  }

  if (useChatModalities) {
    const inputDataUrl = `data:${imageMime};base64,${arrayBufferToBase64(imageBuffer)}`;
    const resp = await fetchJson(`${baseURL}/chat/completions`, {
      apiKey: config.apiKey,
      signal,
      body: JSON.stringify({
        model: config.model,
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: inputDataUrl } },
            ],
          },
        ],
      }),
    });
    const b64 = extractImageFromChatResponse(resp);
    if (b64) return b64;
    throw new Error(diagnoseEmptyImageResponse(resp, config.model));
  }

  // images.edit path - multipart form to OpenAI-compatible providers.
  const fd = new FormData();
  fd.append("model", config.model);
  fd.append("prompt", prompt);
  fd.append(
    "image",
    new Blob([imageBuffer], { type: imageMime }),
    `portrait.${(imageMime.split("/")[1] || "png").replace("jpeg", "jpg")}`,
  );
  fd.append("n", "1");

  const sizeOverride =
    preferLandscape && (config.size === "auto" || config.size === "1024x1024")
      ? "1536x1024"
      : undefined;
  const size = sizeOverride ?? (config.size === "auto" ? undefined : config.size);
  if (size) fd.append("size", size);
  if (config.quality && config.quality !== "auto") fd.append("quality", config.quality);

  const resp = await fetchForm(`${baseURL}/images/edits`, {
    apiKey: config.apiKey,
    signal,
    body: fd,
  });
  const b64 =
    (resp as { data?: { b64_json?: string }[] })?.data?.[0]?.b64_json ?? null;
  if (!b64) {
    throw new Error(diagnoseEmptyImageResponse(resp, config.model));
  }
  return b64;
}

async function generateOneViaProxy(args: {
  config: ClientByokConfig;
  baseURL: string;
  prompt: string;
  imageBuffer: ArrayBuffer;
  imageMime: string;
  preferLandscape: boolean;
  signal?: AbortSignal;
}): Promise<string> {
  const { config, baseURL, prompt, imageBuffer, imageMime, preferLandscape, signal } = args;
  const fd = new FormData();
  fd.append("apiKey", config.apiKey);
  fd.append("baseURL", baseURL);
  fd.append("model", config.model);
  fd.append("prompt", prompt);
  fd.append("preferLandscape", preferLandscape ? "1" : "0");
  fd.append(
    "image",
    new Blob([imageBuffer], { type: imageMime }),
    `portrait.${(imageMime.split("/")[1] || "png").replace("jpeg", "jpg")}`,
  );
  if (config.size) fd.append("size", config.size);
  if (config.quality) fd.append("quality", config.quality);

  const resp = await fetch("/api/showcase/generate", {
    method: "POST",
    body: fd,
    signal,
    credentials: "same-origin",
  });
  const parsed = await parseResponse(resp);
  const b64 = (parsed as { b64?: string })?.b64;
  if (!b64) throw new Error("Provider returned no image data");
  return b64;
}

async function fetchJson(
  url: string,
  opts: { apiKey: string; body: BodyInit; signal?: AbortSignal },
): Promise<unknown> {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: opts.body,
    signal: opts.signal,
    // Do NOT send cookies - direct provider call, fully cross-origin.
    credentials: "omit",
  });
  return parseResponse(r);
}

function shouldUseSameOriginProviderProxy(baseURL: string): boolean {
  try {
    const url = new URL(baseURL);
    return url.hostname.toLowerCase() === "api.openai.com";
  } catch {
    return false;
  }
}

async function fetchForm(
  url: string,
  opts: { apiKey: string; body: FormData; signal?: AbortSignal },
): Promise<unknown> {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    body: opts.body,
    signal: opts.signal,
    credentials: "omit",
  });
  return parseResponse(r);
}

async function parseResponse(r: Response): Promise<unknown> {
  const text = await r.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!r.ok) {
    const apiMessage =
      (parsed as { error?: { message?: string } } | null)?.error?.message ??
      text?.slice(0, 240);
    throw new Error(
      `Provider error ${r.status}${apiMessage ? `: ${apiMessage}` : ""}`,
    );
  }
  return parsed;
}

// Same shape-juggling we do server-side for OpenRouter / Gemini chat models.
function extractImageFromChatResponse(resp: unknown): string | null {
  const choice = (resp as { choices?: unknown[] } | undefined)?.choices?.[0] as
    | { message?: unknown }
    | undefined;
  const message = choice?.message as Record<string, unknown> | undefined;
  if (!message) return null;

  const candidates: unknown[] = [];

  const images = message.images;
  if (Array.isArray(images)) {
    for (const img of images) {
      const url =
        (img as { image_url?: { url?: string }; url?: string })?.image_url?.url ??
        (img as { url?: string })?.url;
      if (typeof url === "string") candidates.push(url);
      const b64Direct = (img as { b64_json?: string })?.b64_json;
      if (typeof b64Direct === "string") candidates.push(b64Direct);
    }
  }

  const content = message.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const p = part as {
        type?: string;
        image_url?: { url?: string } | string;
        image?: { b64_json?: string; url?: string };
        b64_json?: string;
      };
      if (typeof p.image_url === "string") candidates.push(p.image_url);
      else if (p.image_url && typeof p.image_url.url === "string") candidates.push(p.image_url.url);
      if (p.image?.b64_json) candidates.push(p.image.b64_json);
      if (p.image?.url) candidates.push(p.image.url);
      if (typeof p.b64_json === "string") candidates.push(p.b64_json);
    }
  }

  if (typeof content === "string") candidates.push(content);

  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    if (!s) continue;
    if (s.startsWith("data:")) {
      const comma = s.indexOf(",");
      if (comma > 0) return s.slice(comma + 1);
      continue;
    }
    if (s.length > 256 && /^[A-Za-z0-9+/=\s]+$/.test(s)) {
      return s.replace(/\s+/g, "");
    }
  }
  return null;
}

function diagnoseEmptyImageResponse(resp: unknown, model: string): string {
  const r = resp as {
    error?: { message?: string; code?: string | number };
    choices?: { message?: { content?: unknown }; finish_reason?: string }[];
  };
  if (r?.error?.message) return `Model error: ${r.error.message}`;
  const choice = r?.choices?.[0];
  const finish = choice?.finish_reason;
  const content = choice?.message?.content;
  if (typeof content === "string" && content.trim()) {
    const snippet = content.trim().slice(0, 240);
    return `Model "${model}" returned text instead of an image: "${snippet}"`;
  }
  if (finish && finish !== "stop") {
    return `Model "${model}" returned no image (finish_reason: ${finish}). Verify the model supports image output.`;
  }
  return `Model "${model}" returned no image. Verify the model id supports image generation on this provider.`;
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
