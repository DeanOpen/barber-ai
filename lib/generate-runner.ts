import OpenAI, { toFile } from "openai";
import type { Settings } from "./settings";
import { getJob, setItemStatus, maybeFinish } from "./jobs";
import { applyWatermark } from "./watermark";

function buildMensSalonDirection(gender: "man" | "woman" | "child"): string {
  if (gender !== "man") return "";
  return `
[ASIAN/KOREAN MEN'S SALON DIRECTION]
- Use contemporary Asian/Korean men's salon references for the haircut shape, root volume, texture, and finish whenever the chosen style allows it.
- This direction applies only to the hair. Preserve the input person's original ethnicity, face, and identity exactly.
`.trim();
}

const HAIRSTYLE_MATCH_GUIDE = `
[HAIRSTYLE MATCH GUIDE]
- The selected haircut must be recognizable at thumbnail size from its silhouette, fringe, parting, fade/taper height, sideburn shape, crown volume, nape/back length, and curl or wave pattern.
- For fades, tapers, undercuts, mullets, buns, top knots, and mohawks, make the side and nape structure visible from the existing head angle without adding another person or extra view.
- For perms, curtain styles, crops, fringes, and side parts, make the front texture and parting unmistakable. Avoid generic salon hair if the named style has a specific shape.
- Do not add colored outlines, labels, arrows, measurement marks, text, or consultation graphics.
`.trim();

function buildGridPrompt(opts: {
  gender: "man" | "woman" | "child";
  styles: { name: string; description: string }[];
}): string {
  const { gender, styles } = opts;
  const mensSalonDirection = buildMensSalonDirection(gender);
  const cols = styles.length <= 4 ? styles.length : styles.length <= 6 ? 3 : 4;
  const rows = Math.ceil(styles.length / cols);
  const numbered = styles
    .map((s, i) => `${i + 1}. "${s.name}" - ${s.description}`)
    .join("\n");
  return `
PHOTOREALISTIC LOOKBOOK COMPOSITE - ${styles.length} variants of the SAME ${gender} from the input photo, arranged in a tidy ${rows}×${cols} grid on one image.

[IDENTITY LOCK - APPLIES TO EVERY CELL]
- Every face in the grid is the EXACT same ${gender} from the input photo.
- Preserve face shape, jawline, cheekbones, nose, mouth, eyes, eye color, eyebrows, skin tone, skin texture, freckles/marks, age, and ethnicity EXACTLY.
- Same head pose, same camera angle, same gaze direction in every cell.
- Do NOT beautify, slim, smooth, or de-age the face.
- The ONLY difference between cells is the hairstyle.

[GRID LAYOUT]
- ${rows} rows × ${cols} columns, equal-sized cells, thin neutral dividers, clean white background.
- Head-and-shoulders framing in every cell, consistent lighting and color grading across cells.
- Below each cell, a small clear label with the hairstyle name in bold sans-serif text.

[HAIRSTYLES - ONE PER CELL, IN ORDER]
${numbered}

${mensSalonDirection ? `${mensSalonDirection}\n` : ""}
Each cell must clearly show its corresponding hairstyle (length, shape, parting, volume, texture). Do not blend old hair with new hair; replace the hairstyle completely in each cell.

${HAIRSTYLE_MATCH_GUIDE}

[RENDER]
Studio-quality lighting, sharp focus on every face, consistent neutral seamless background, professional barbershop / salon lookbook layout. No watermark, no extra people, no text other than the hairstyle name labels.
`.trim();
}

function buildPrompt(opts: {
  gender: "man" | "woman" | "child";
  hairstyleName: string;
  hairstyleDescription: string;
}): string {
  const { gender, hairstyleName, hairstyleDescription } = opts;
  const mensSalonDirection = buildMensSalonDirection(gender);
  return `
PHOTOREALISTIC PORTRAIT EDIT - change ONLY the hair, keep the face 100% identical.

[IDENTITY LOCK - DO NOT CHANGE]
- Exact same ${gender} from the input photo.
- Preserve face shape, jawline, cheekbones, nose, mouth, eyes, eye color, eyebrows, skin tone, skin texture, freckles/marks, age, and ethnicity EXACTLY.
- Same head pose, same camera angle, same gaze direction.
- Do NOT beautify, slim, smooth, or de-age the face.

[HAIR TRANSFORMATION - REPLACE COMPLETELY]
Remove the subject's current hairstyle entirely. Do not blend old hair with new hair. The new hair must be the only hair visible.

New hairstyle name: "${hairstyleName}".
Visual description: ${hairstyleDescription}.

${mensSalonDirection ? `${mensSalonDirection}\n` : ""}
The final silhouette of the head must clearly show a "${hairstyleName}" - its length, shape, parting, volume, and texture must visibly match the description above, not the original photo.

${HAIRSTYLE_MATCH_GUIDE}

[RENDER]
Studio-quality lighting, sharp focus on the face, neutral seamless background, head-and-shoulders framing, natural color grading, professional barbershop / salon portrait photography. No text, no watermark, no extra people.
`.trim();
}

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
  // Grids look much better in landscape - override "auto" sizing only.
  const sizeOverride =
    preferLandscape && settings.size === "auto" ? "1536x1024" : undefined;
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

  const promptGender: "man" | "woman" | "child" =
    entry.job.gender === "kid" ? "child" : entry.job.gender;

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
    const stamped = await applyWatermark(
      Buffer.from(rawB64, "base64"),
      settings.watermark,
    );
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
