import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

class ProviderResponseError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeOpenAIBaseURL(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid API host");
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "api.openai.com") {
    throw new Error("The same-origin proxy only supports https://api.openai.com/v1");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "") || "/v1"}`;
}

function pickString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function providerError(status: number, body: unknown, raw: string): ProviderResponseError {
  const message =
    (body as { error?: { message?: string } } | null)?.error?.message ??
    (body as { error?: string } | null)?.error ??
    raw.slice(0, 240) ??
    "Provider request failed";
  return new ProviderResponseError(status, `Provider error ${status}: ${message}`);
}

async function parseProviderResponse(resp: Response): Promise<unknown> {
  const text = await resp.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!resp.ok) throw providerError(resp.status, parsed, text);
  return parsed;
}

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
    error?: { message?: string };
    choices?: { message?: { content?: unknown }; finish_reason?: string }[];
  };
  if (r?.error?.message) return `Model error: ${r.error.message}`;
  const choice = r?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return `Model "${model}" returned text instead of an image: "${content.trim().slice(0, 240)}"`;
  }
  return `Model "${model}" returned no image data`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const apiKey = pickString(form, "apiKey");
    const model = pickString(form, "model");
    const prompt = pickString(form, "prompt");
    const image = form.get("image");
    if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    if (!model) return NextResponse.json({ error: "Missing model" }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    const baseURL = normalizeOpenAIBaseURL(form.get("baseURL"));
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageMime = image.type || "image/png";
    const preferLandscape = pickString(form, "preferLandscape") === "1";
    const sizeRaw = pickString(form, "size");
    const qualityRaw = pickString(form, "quality");
    const sizeOverride =
      preferLandscape && (sizeRaw === "auto" || sizeRaw === "1024x1024")
        ? "1536x1024"
        : undefined;
    const size = sizeOverride ?? (sizeRaw && sizeRaw !== "auto" ? sizeRaw : "");
    const quality = qualityRaw && qualityRaw !== "auto" ? qualityRaw : "";

    if (model.includes("/")) {
      const inputDataUrl = `data:${imageMime};base64,${imageBuffer.toString("base64")}`;
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
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
      const parsed = await parseProviderResponse(resp);
      const b64 = extractImageFromChatResponse(parsed);
      if (!b64) throw new Error(diagnoseEmptyImageResponse(parsed, model));
      return NextResponse.json({ b64 });
    }

    const providerForm = new FormData();
    providerForm.append("model", model);
    providerForm.append("prompt", prompt);
    providerForm.append(
      "image",
      new Blob([imageBuffer], { type: imageMime }),
      image.name || `portrait.${(imageMime.split("/")[1] || "png").replace("jpeg", "jpg")}`,
    );
    providerForm.append("n", "1");
    if (size) providerForm.append("size", size);
    if (quality) providerForm.append("quality", quality);

    const resp = await fetch(`${baseURL}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: providerForm,
    });
    const parsed = await parseProviderResponse(resp);
    const b64 =
      (parsed as { data?: { b64_json?: string }[] })?.data?.[0]?.b64_json ?? null;
    if (!b64) throw new Error(diagnoseEmptyImageResponse(parsed, model));
    return NextResponse.json({ b64 });
  } catch (err) {
    if (err instanceof ProviderResponseError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
