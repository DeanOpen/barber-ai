import OpenAI, { toFile } from "openai";
import type { Settings } from "./settings";
import { getJob, setItemStatus, maybeFinish } from "./jobs";
import { buildGridPrompt, buildPrompt, type PromptGender } from "./prompts";
import { applyGridLabels, applyWatermark } from "./watermark";

// OpenRouter and other chat-completions providers can return generated images
// in several shapes depending on the model. Try each known location and return
// raw base64 (no data: prefix) as soon as we find one.
function extractImageFromChatResponse(resp: unknown): string | null {
  const choice = (resp as { choices?: unknown[] } | undefined)?.choices?.[0] as
    | { message?: unknown }
    | undefined;
  const message = choice?.message as Record<string, unknown> | undefined;
  if (!message) return null;

  const candidates: unknown[] = [];

  // Shape 1: OpenRouter Gemini/image models - message.images[].image_url.url
  const images = message.images;
  if (Array.isArray(images)) {
    for (const img of images) {
      const url = (img as { image_url?: { url?: string }; url?: string })?.image_url?.url
        ?? (img as { url?: string })?.url;
      if (typeof url === "string") candidates.push(url);
      const b64Direct = (img as { b64_json?: string })?.b64_json;
      if (typeof b64Direct === "string") candidates.push(b64Direct);
    }
  }

  // Shape 2: content array with image_url / output_image parts
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

  // Shape 3: content as a string that itself is a data URL
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
    // Heuristic: long base64-ish payload returned directly.
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

async function generateOne(args: {
  client: OpenAI;
  settings: Settings;
  buffer: Buffer;
  imageMime: string;
  filename: string;
  prompt: string;
  preferLandscape?: boolean;
}): Promise<string> {
  const {
    client,
    settings,
    buffer,
    imageMime,
    filename,
    prompt,
    preferLandscape,
  } = args;

  const useChatModalities = settings.model.includes("/");

  if (useChatModalities) {
    const inputDataUrl = `data:${imageMime};base64,${buffer.toString("base64")}`;
    const resp = await client.chat.completions.create({
      model: settings.model,
      modalities: ["image", "text"] as unknown as ["text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: inputDataUrl } },
          ],
        },
      ],
    });
    const b64 = extractImageFromChatResponse(resp);
    if (b64) return b64;
    throw new Error(diagnoseEmptyImageResponse(resp, settings.model));
  }

  const image = await toFile(buffer, filename, { type: imageMime });
  // Grids need landscape space for distinct cells and readable app-rendered labels.
  const sizeOverride =
    preferLandscape && (settings.size === "auto" || settings.size === "1024x1024")
      ? "1536x1024"
      : undefined;
  const resp = await client.images.edit({
    model: settings.model,
    image,
    prompt,
    size:
      sizeOverride ?? (settings.size === "auto" ? undefined : settings.size),
    quality: settings.quality === "auto" ? undefined : settings.quality,
    n: 1,
  });
  const b64 = resp.data?.[0]?.b64_json;
  if (!b64) throw new Error("Model returned no image data");
  return b64;
}

export async function runItem(args: {
  jobId: string;
  index: number;
  settings: Settings;
}): Promise<void> {
  const { jobId, index, settings } = args;
  const entry = getJob(jobId);
  if (!entry) return;
  const item = entry.job.items[index];
  if (!item) return;
  if (item.status === "running") return; // already in flight

  await setItemStatus(jobId, index, { status: "running", error: undefined });

  const promptGender: PromptGender = entry.job.gender === "kid" ? "child" : entry.job.gender;

  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL?.trim() || undefined,
  });

  try {
    const isGrid = item.kind === "grid";
    const prompt = isGrid
      ? buildGridPrompt({
          gender: promptGender,
          styles: item.gridStyles ?? [],
        })
      : buildPrompt({
          gender: promptGender,
          hairstyleName: item.name,
          hairstyleDescription: item.description,
        });
    const rawB64 = await generateOne({
      client,
      settings,
      buffer: entry.image,
      imageMime: entry.imageMime,
      filename: "portrait.png",
      prompt,
      preferLandscape: isGrid,
    });
    const watermarked = await applyWatermark(
      Buffer.from(rawB64, "base64"),
      settings.watermark,
    );
    const stamped = isGrid
      ? await applyGridLabels(watermarked, item.gridStyles ?? [])
      : watermarked;
    const b64 = stamped.toString("base64");
    await setItemStatus(jobId, index, { status: "done", b64, error: undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setItemStatus(jobId, index, {
      status: "failed",
      b64: null,
      error: message,
    });
  } finally {
    await maybeFinish(jobId);
  }
}

export async function runAllPending(args: {
  jobId: string;
  settings: Settings;
  concurrency?: number;
}): Promise<void> {
  const { jobId, settings } = args;
  const concurrency = Math.max(1, Math.min(args.concurrency ?? 3, 6));
  const entry = getJob(jobId);
  if (!entry) return;

  const indices: number[] = entry.job.items
    .map((it, i) => (it.status === "pending" ? i : -1))
    .filter((i) => i >= 0);

  let cursor = 0;
  async function worker() {
    while (cursor < indices.length) {
      const i = indices[cursor++];
      await runItem({ jobId, index: i, settings });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await maybeFinish(jobId);
}
