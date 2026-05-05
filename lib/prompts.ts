// Prompt templates used by both the server-side runner and the public-showcase
// client-side runner. Kept dependency-free so it's safe to import from a
// browser bundle.

export type PromptGender = "man" | "woman" | "child";

export type PromptStyle = {
  name: string;
  description: string;
};

export function resolveGridShape(count: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 1, rows: 0 };
  const cols = count <= 4 ? count : count <= 6 ? 3 : 4;
  return { cols, rows: Math.ceil(count / cols) };
}

function buildMensSalonDirection(gender: PromptGender): string {
  if (gender !== "man") return "";
  return `
[ASIAN/KOREAN MEN'S SALON DIRECTION]
- Use contemporary Asian/Korean men's salon references for the haircut shape, root volume, texture, and finish whenever the chosen style allows it.
- This direction applies only to the hair. Preserve the input person's original ethnicity, face, and identity exactly.
`.trim();
}

function normalizeStyleText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasStyleTerm(text: string, term: string): boolean {
  return text.includes(normalizeStyleText(term));
}

function buildStyleSignature(style: PromptStyle): string {
  const name = normalizeStyleText(style.name);
  const all = normalizeStyleText(`${style.name} ${style.description}`);
  const cues: string[] = [];
  const add = (cue: string) => {
    if (!cues.includes(cue)) cues.push(cue);
  };

  if (hasStyleTerm(name, "two block")) {
    add("two-block structure: longer top layer sits over clearly shorter hidden undercut sides around the ears, with a clean tapered nape");
  }
  if (hasStyleTerm(name, "hush cut")) {
    add("hush cut structure: medium layered hair, soft face-framing pieces, feathered nape, wispy ends, and light crown volume instead of a barber fade");
  }
  if (hasStyleTerm(name, "shadow perm")) {
    add("shadow perm texture: short-to-medium top with subtle C-shaped bends, shadowy wave separation, and soft root lift, not straight flat hair or tight curls");
  }
  if (hasStyleTerm(name, "edgar")) {
    add("Edgar cut structure: blunt straight horizontal fringe across the forehead, square temple lineup, compact textured top, and visible mid skin fade");
  }
  if (hasStyleTerm(name, "regent")) {
    add("regent structure: front hair lifted upward and brushed back, controlled top volume, clean temple line, and tight tapered sides");
  }
  if (hasStyleTerm(name, "quiff")) {
    add("quiff structure: front hair rises upward and backward into visible height, with choppy texture through the top and faded sides");
  }
  if (hasStyleTerm(name, "man bun") || hasStyleTerm(name, "top knot") || hasStyleTerm(name, "samurai")) {
    add("bun/top-knot structure: enough long hair is gathered into a visible tied knot at the back/crown while the sides or undercut are exposed");
  }
  if (hasStyleTerm(name, "burst fade")) {
    add("burst fade structure: fade curves in a semicircle around both ears and drops into a tapered neckline, not a normal straight side fade");
  }
  if (hasStyleTerm(name, "wolf cut")) {
    add("wolf cut structure: shaggy layered crown, broken fringe, textured sides, and longer wispy nape/back length");
  }
  if (hasStyleTerm(name, "mullet")) {
    add("mullet structure: shorter front/sides with visibly longer back length at the nape or collar");
  }
  if (hasStyleTerm(name, "comma")) {
    add("comma hair structure: one front fringe curves inward like a comma over one eyebrow with a natural side part and soft root lift");
  }
  if (hasStyleTerm(name, "bowl")) {
    add("bowl cut structure: rounded cap silhouette with eyebrow-length curved fringe and shorter hidden sides underneath");
  }
  if (hasStyleTerm(name, "crop")) {
    add("crop structure: short forward-swept top, choppy blunt fringe, and low compact silhouette");
  }
  if (hasStyleTerm(name, "caesar")) {
    add("Caesar structure: very short even top and a straight blunt horizontal fringe line across the forehead");
  }
  if (hasStyleTerm(name, "buzz")) {
    add("buzz cut structure: uniform clipper-short hair over the full head with scalp lightly visible and no styling volume");
  }
  if (hasStyleTerm(name, "crew cut") || hasStyleTerm(name, "high and tight")) {
    add("crew/high-and-tight structure: short athletic top, clipped tight sides, clean natural hairline, and minimal volume");
  }
  if (hasStyleTerm(name, "pompadour")) {
    add("pompadour structure: glossy top combed up and back into strong height with tight tapered or faded sides");
  }
  if (hasStyleTerm(name, "side part") || hasStyleTerm(name, "comb over")) {
    add("side-part structure: visible clean part line with top hair combed diagonally to one side and a neat tapered side profile");
  }
  if (hasStyleTerm(name, "curtain") || hasStyleTerm(name, "middle part")) {
    add("curtain structure: clear center or soft middle part with front pieces falling to both sides of the face");
  }
  if (hasStyleTerm(name, "fringe")) {
    add("fringe structure: visible front bangs over the forehead with the exact density and direction named by the style");
  }
  if (hasStyleTerm(name, "mohawk") || hasStyleTerm(name, "faux hawk")) {
    add("hawk structure: narrow raised strip or ridge from forehead to crown with sides much shorter than the center");
  }
  if (hasStyleTerm(all, "curl") || hasStyleTerm(all, "coily") || hasStyleTerm(all, "afro")) {
    add("curl structure: distinct curl or coil clumps with rounded volume, not random messy straight texture");
  }
  if (hasStyleTerm(name, "perm") || hasStyleTerm(name, "wave")) {
    add("perm/wave structure: intentional repeated bends or waves through the hair, with the curl size and looseness matching the style name");
  }
  if (hasStyleTerm(name, "undercut")) {
    add("undercut structure: a clearly disconnected short side section under longer top hair");
  }
  if (hasStyleTerm(name, "fade")) {
    add("fade structure: sides visibly graduate from very short near the lower edge into longer hair above");
  }
  if (hasStyleTerm(name, "taper")) {
    add("taper structure: clean gradual shortening around ears and neckline without turning the whole cut into a generic fade");
  }
  if (hasStyleTerm(name, "slick back")) {
    add("slick-back structure: top hair combed backward away from the forehead with controlled shine");
  }
  if (hasStyleTerm(name, "flow") || hasStyleTerm(name, "layers") || hasStyleTerm(name, "shoulder length")) {
    add("long-flow structure: medium-to-long layered hair with visible length around the ears, cheeks, nape, or shoulders");
  }

  if (cues.length === 0) {
    add("the haircut anatomy must make the named style recognizable from silhouette, fringe, side profile, crown volume, length, and texture");
  }

  return cues.slice(0, 5).join("; ");
}

function buildStyleContract(style: PromptStyle): string {
  return `
Style name: "${style.name}".
Catalog description: ${style.description}.
Required haircut anatomy: ${buildStyleSignature(style)}.
Do not substitute a generic curtain cut, side part, quiff, crop, fade, or the person's original hairstyle unless that exact anatomy is named above.
If the named haircut needs more or less hair length than the input photo, change the hair length enough to make that style visibly true.
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
  const styleContract = buildStyleContract({
    name: hairstyleName,
    description: hairstyleDescription,
  });
  return `
PHOTOREALISTIC PORTRAIT EDIT - change ONLY the hair, keep the face 100% identical.

[IDENTITY LOCK - DO NOT CHANGE]
- Exact same ${gender} from the input photo.
- Preserve face shape, jawline, cheekbones, nose, mouth, eyes, eye color, eyebrows, skin tone, skin texture, freckles/marks, age, and ethnicity EXACTLY.
- Same head pose, same camera angle, same gaze direction.
- Do NOT beautify, slim, smooth, or de-age the face.

[HAIR TRANSFORMATION - REPLACE COMPLETELY]
Remove the subject's current hairstyle entirely. Do not blend old hair with new hair. The new hair must be the only hair visible.

[TARGET HAIRCUT - STRICT]
${styleContract}

${mensSalonDirection ? `${mensSalonDirection}\n` : ""}
The final silhouette of the head must clearly show a "${hairstyleName}" - its length, shape, parting, volume, side/nape structure, and texture must visibly match the target haircut above, not the original photo.

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
  const { cols, rows } = resolveGridShape(styles.length);
  const numbered = styles
    .map((s, i) => {
      const row = Math.floor(i / cols) + 1;
      const col = (i % cols) + 1;
      return `Cell ${i + 1} (row ${row}, column ${col}): ${buildStyleContract(s)}`;
    })
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
- ${rows} rows × ${cols} columns, equal-sized cells, thin neutral dividers, clean white background. Fill the full image with the grid; do not add black side gutters, blank spacer columns, or duplicate filler cells.
- Head-and-shoulders framing in every cell, consistent lighting and color grading across cells.
- Leave a little clean space near the bottom of each cell for the app to place labels later. Do not render any text, numbers, letters, captions, or typography inside the image.

[HAIRSTYLES - EXACT CELL MAP]
${numbered}

${mensSalonDirection ? `${mensSalonDirection}\n` : ""}
Each cell must clearly show its corresponding hairstyle (length, shape, parting, volume, side/nape structure, curl/wave pattern, and texture). Make the haircut anatomy visibly different between cells when the names are different. Match the exact cell map above; do not swap styles between cells and do not repeat one hairstyle across multiple cells unless it is listed more than once. Do not blend old hair with new hair; replace the hairstyle completely in each cell.

${HAIRSTYLE_MATCH_GUIDE}

[RENDER]
Studio-quality lighting, sharp focus on every face, consistent neutral seamless background, professional barbershop / salon lookbook layout. No watermark, no extra people, no text.
`.trim();
}
