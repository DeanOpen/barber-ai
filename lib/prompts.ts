// Prompt templates used by both the server-side runner and the public-showcase
// client-side runner. Kept dependency-free so it's safe to import from a
// browser bundle.

export type PromptGender = "man" | "woman" | "child";

export type PromptStyle = {
  name: string;
  description: string;
};

function buildMensSalonDirection(gender: PromptGender): string {
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

export function buildPrompt(opts: {
  gender: PromptGender;
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

export function buildGridPrompt(opts: {
  gender: PromptGender;
  styles: PromptStyle[];
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
