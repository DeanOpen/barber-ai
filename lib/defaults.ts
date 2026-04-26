// Public, client-safe defaults. NO node-only imports here so this module is
// safe to bundle in client components (e.g. the PUBLIC_SHOWCASE flow that runs
// entirely in the browser with no /api/status round trip).

export type Gender = "man" | "woman" | "kid";

export type Hairstyle = {
  name: string;
  description: string;
  imageUrl?: string;
  section?: string;
};

export type GenerationMode = "individual" | "grid";

export type WatermarkPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "bottom-center";

export type Watermark = {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  opacity: number; // 0..1
  size: number;   // relative size (fraction of image width); 0.04 ≈ 4%
  color: string;
};

export type PublicSettings = {
  model: string;
  mode: GenerationMode;
  imageCount: number;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality: "low" | "medium" | "high" | "auto";
  watermark: Watermark;
  prompts: Record<Gender, Hairstyle[]>;
  categoryImages: Record<Gender, string>;
};

const U = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&auto=format&fit=crop&q=80`;

const L = (file: string) => `/style-references/${file}`;

export const PUBLIC_DEFAULTS: PublicSettings = {
  model: "gpt-image-2",
  mode: "individual",
  imageCount: 4,
  size: "1024x1024",
  quality: "high",
  watermark: {
    enabled: false,
    text: "@deanopen",
    position: "bottom-right",
    opacity: 0.7,
    size: 0.035,
    color: "#ffffff",
  },
  prompts: {
    man: [
      { section: "Asian-Inspired", name: "Korean Two-Block", description: "Volumized longer top about 8 cm, sides and back shaved short above the ears in a hidden two-block style, soft curtain fringe falling across the forehead, glossy K-pop styling, dark natural color", imageUrl: L("men/korean-two-block.jpg") },
      { section: "Asian-Inspired", name: "Korean Wolf Cut", description: "Layered mullet-style cut, choppy crown volume, longer wispy back about chin length, thin tapered nape, wispy bangs framing the eyes, edgy Seoul streetwear vibe", imageUrl: L("men/korean-wolf-cut.webp") },
      { section: "Modern Barbershop", name: "Edgar Cut", description: "Flat blunt fringe cut straight across the forehead with no taper, mid skin fade on the sides, sharp lined-up hairline, modern Latin-American barbershop style", imageUrl: L("men/edgar-cut.jpg") },
      { section: "Modern Barbershop", name: "Slick-Back Pompadour", description: "Glossy hair on top about 10 cm long combed up and back with strong volume above the forehead, tight tapered fade on the sides, sharp shaved side parting line, vintage gentleman finish", imageUrl: L("men/slick-back-pompadour.webp") },
      { section: "Modern Barbershop", name: "Textured French Crop", description: "Short forward-swept fringe with piecey separated strands on top about 4 cm, mid drop fade on the sides and back, matte natural finish, modern European barbershop", imageUrl: L("men/textured-french-crop.webp") },
      { section: "Modern Barbershop", name: "Classic Side Part", description: "Hair on top about 4 cm combed neatly to one side over a deep parting line, scissor-cut tapered sides blending into a natural neckline, polished business style", imageUrl: L("men/classic-side-part.jpg") },
      { section: "Short & Clean", name: "Buzz Cut", description: "Uniform 3 mm clipper length all over the head, scalp lightly visible through the hair, sharp natural front hairline at the forehead, completely flat with no styling", imageUrl: L("men/buzz-cut.webp") },
      { section: "Short & Clean", name: "Caesar Cut", description: "Short even 2 cm hair all over the head, straight blunt fringe across the forehead, classic Roman-style horizontal hairline", imageUrl: L("men/caesar-cut.jpg") },
      { section: "Long & Textured", name: "Curly Afro Taper", description: "Defined springy 8 cm coils on top with even volume all around the head, clean tapered sideburns and neckline, neat rounded silhouette, natural black hair", imageUrl: L("men/curly-afro-taper.webp") },
      { section: "Long & Textured", name: "Man Bun Undercut", description: "Long hair pulled tightly into a smooth bun at the back of the crown, shaved undercut from ear to ear, exposed temples and nape, no flyaways", imageUrl: L("men/man-bun-undercut.webp") },
      { section: "Long & Textured", name: "90s Curtain Hair", description: "Shoulder-length straight hair parted in the middle, soft curtain bangs framing both sides of the face, slightly tousled ends, 1990s Leonardo DiCaprio vibe", imageUrl: L("men/90s-curtain-hair.webp") },
      { section: "Edgy & Statement", name: "Mohawk", description: "Sides shaved down to skin from temple to nape, central strip of upright hair about 7 cm tall styled into vertical spikes, sharp geometric outline", imageUrl: L("men/mohawk.jpg") },
    ],
    woman: [
      { section: "Asian-Inspired", name: "Korean Curly Perm", description: "Shoulder-length S-curl perm with soft loose curls, full volume around the face, middle-parted curtain bangs, glossy chestnut brown tone, Korean salon style" },
      { section: "Asian-Inspired", name: "Hime Cut", description: "Long straight jet-black hair past the shoulder blades, blunt cheek-length front side strands cut sharply at the cheekbone, straight blunt fringe across the forehead, geometric Japanese princess outline" },
      { section: "Bobs & Lobs", name: "French Bob", description: "Chin-length blunt bob with a soft inward bend at the ends, blunt micro-bangs sitting just above the eyebrows, polished Parisian finish, dark brown" },
      { section: "Bobs & Lobs", name: "Sleek Glass Bob", description: "Sharp chin-length blunt bob cut perfectly straight across, mirror-like glassy shine, deep side parting, sleek tucked behind one ear, no layers" },
      { section: "Bobs & Lobs", name: "Curtain Bangs Lob", description: "Shoulder-length lob with a soft inward bend at the ends, middle-parted curtain bangs framing the cheekbones, subtle face-framing layers, lived-in caramel balayage" },
      { section: "Long & Wavy", name: "Beach Waves", description: "Long loose S-shaped waves falling past the chest, sun-kissed caramel highlights, middle parting, soft face-framing layers around the cheekbones, glossy ends" },
      { section: "Long & Wavy", name: "Long Sleek Straight", description: "Jet-flat poker-straight hair down to the lower back, center parting, blunt straight ends, mirror-like glassy shine from root to tip" },
      { section: "Long & Textured", name: "Voluminous Curls", description: "Tight defined ringlet curls at shoulder length, wide halo of volume all around the head, no visible parting, frizz-free hydrated finish" },
      { section: "Long & Textured", name: "Wolf Cut", description: "Heavy shaggy collarbone-length layers, choppy curtain bangs, lots of texture and volume around the crown, undone rocker energy, lived-in dark brown" },
      { section: "Short & Edgy", name: "Pixie Cut", description: "Hair about 4 cm long on top, very short tapered sides and nape, long side-swept fringe sweeping across the forehead to one eyebrow, edgy modern silhouette" },
      { section: "Updos & Braids", name: "High Slick Ponytail", description: "Slicked-back high ponytail tied at the very crown of the head, glassy roots with zero flyaways, long polished ponytail reaching past the shoulder blades" },
      { section: "Updos & Braids", name: "Box Braids", description: "Long thin box braids reaching the lower back, neat parted small square sections visible at the scalp, braids gathered loosely behind the shoulders, natural black" },
    ],
    kid: [
      { section: "Classic", name: "Bowl Cut", description: "Straight blunt fringe across the eyebrows, hair length just covering the ears all the way around, soft rounded mushroom silhouette, kid-friendly" },
      { section: "Classic", name: "School Side Part", description: "Hair on top about 4 cm neatly combed to one side over a soft parting line, tapered short sides above the ears, classic classroom-portrait style" },
      { section: "Classic", name: "Buzz Cut", description: "Uniform 5 mm clipper length all over, clean natural hairline at the forehead and around the ears, freshly clipped finish" },
      { section: "Playful", name: "Pigtails", description: "Two symmetrical pigtails tied high on either side of the head with colorful elastics, hair length reaching the shoulders, small face-framing wisps at the front" },
      { section: "Playful", name: "Top Knot Bun", description: "High top-knot bun on the very crown of the head, smooth gathered roots, small wispy baby hairs at the hairline, neat and tidy" },
      { section: "Playful", name: "Twin Buns", description: "Two symmetrical small space buns high on either side of the head, smooth gathered roots, cute and tidy, no flyaways" },
      { section: "Playful", name: "Mini Afro", description: "Curly natural afro about 5 cm tall with even volume all around the head, soft defined coils, neat rounded outline, child-sized silhouette" },
      { section: "Edgy & Fun", name: "Messy Crop", description: "Short messy textured top about 3 cm with forward-pushed piecey fringe, scissor-cut short sides, playful undone finish, lively kid energy" },
      { section: "Edgy & Fun", name: "Mohawk Faux", description: "Soft strip of upward-styled hair down the center of the head, sides kept short but not shaved, playful kid-friendly mohawk" },
      { section: "Edgy & Fun", name: "Surfer Shag", description: "Tousled sun-bleached layered hair at ear-covering length, soft side-swept fringe across the forehead, beachy undone finish" },
      { section: "Long Styles", name: "Long Side Braid", description: "Long straight hair reaching the mid-back, simple middle parting, single thick three-strand braid resting over one shoulder, small wisps at the temple" },
      { section: "Long Styles", name: "Princess Curls", description: "Long ringlet curls falling past the shoulders, half-up half-down style with a small bow tied on top, glossy soft brown" },
    ],
  },
  categoryImages: {
    man: U("photo-1500648767791-00dcc994a43e"),
    woman: U("photo-1494790108377-be9c29b29330"),
    kid: U("photo-1503454537195-1dcabb73ffb9"),
  },
};
