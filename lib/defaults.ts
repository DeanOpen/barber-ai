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
  mode: "grid",
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
      { section: "Asian-Inspired", name: "Mullet", description: "Modern Korean mullet with layered textured crown, soft broken fringe, sides tapered close around the ears, back left longer at the nape with wispy movement, matte dark salon finish", imageUrl: L("men/mullet.jpg") },
      { section: "Asian-Inspired", name: "Wolf Cut", description: "Korean wolf cut with choppy crown layers, airy curtain fringe, textured sides, wispy layered back reaching the neck, dark natural hair with undone Seoul streetwear finish", imageUrl: L("men/wolf-cut.jpg") },
      { section: "Asian-Inspired", name: "Shaggy Haircut", description: "Medium Korean shag with tousled layers through the top and sides, messy eyebrow-length fringe, soft crown volume, feathered nape, matte natural movement without looking bulky", imageUrl: L("men/shaggy-haircut.jpg") },
      { section: "Asian-Inspired", name: "Warrior Cut", description: "Long warrior-inspired half-up top knot with loose layered lengths falling behind the ears, clean controlled sides, strong center shape, polished dark Korean editorial finish", imageUrl: L("men/warrior-cut.jpg") },
      { section: "Asian-Inspired", name: "Korean Comma Hair", description: "Medium Korean comma hairstyle with the front fringe curved inward like a comma over one eyebrow, natural side part, soft root lift, tapered sides, glossy dark salon finish", imageUrl: L("men/korean-comma-hair.jpg") },
      { section: "Asian-Inspired", name: "Dandy Cut", description: "Neat Korean dandy cut with short-medium rounded top, soft natural side part, clean tapered sides around the ears, tidy neckline, smooth lightweight volume", imageUrl: L("men/dandy-cut.jpg") },
      { section: "Asian-Inspired", name: "Leaf Cut", description: "Medium Korean leaf cut with center-parted front pieces curved outward like soft leaves, layered sides brushing the temples, airy root volume, polished dark finish", imageUrl: L("men/leaf-cut.jpg") },
      { section: "Asian-Inspired", name: "Hush Cut", description: "Medium hush cut with soft face-framing layers, light choppy crown volume, feathered nape, wispy ends, relaxed Korean salon texture without heavy bulk", imageUrl: L("men/hush-cut.jpg") },
      { section: "Asian-Inspired", name: "See-Through Fringe", description: "Light wispy see-through fringe across the forehead, short-to-medium textured top, soft low taper around the ears, natural dark hair with airy K-drama finish", imageUrl: L("men/see-through-fringe.jpg") },
      { section: "Asian-Inspired", name: "Korean Bowl Cut", description: "Modern Korean bowl cut with rounded eyebrow-length fringe, soft undercut sides hidden under the top layer, clean curved silhouette, glossy dark salon finish", imageUrl: L("men/korean-bowl-cut.jpg") },
      { section: "Perms", name: "Korean Soft Wave Perm", description: "Medium 8 cm top shaped into soft loose S-waves with natural lift at the roots, relaxed curtain fringe, low tapered sides, airy Korean salon texture, matte natural finish", imageUrl: L("men/korean-soft-wave-perm.jpg") },
      { section: "Perms", name: "Korean Shadow Perm", description: "Short-to-medium 6 cm top with subtle C-shaped bends and shadowy texture instead of tight curls, light root volume, clean tapered sides, natural K-drama style movement", imageUrl: L("men/korean-shadow-perm.jpg") },
      { section: "Perms", name: "Korean Root Volume Perm", description: "Mostly straight medium hair with visible lift only at the crown and front roots, soft side-swept shape, no tight curl pattern, neat tapered sides, natural lightweight volume", imageUrl: L("men/korean-root-volume-perm.jpg") },
      { section: "Perms", name: "Men's Down Perm", description: "Straight controlled hair on the sides pressed flat and smooth against the head, top left natural with light texture, clean two-block outline, no side puff or frizz", imageUrl: L("men/mens-down-perm.jpg") },
      { section: "Perms", name: "Loose Body Wave Perm", description: "Medium 10 cm hair with broad relaxed body waves through the top and sides, natural movement over the ears, soft rounded volume, casual low-maintenance finish", imageUrl: L("men/loose-body-wave-perm.jpg") },
      { section: "Perms", name: "Digital S-Wave Perm", description: "Medium-long 12 cm hair set into polished S-shaped waves that are strongest through the mid-lengths and ends, center parting, glossy controlled Korean-Japanese salon finish", imageUrl: L("men/digital-s-wave-perm.jpg") },
      { section: "Perms", name: "Spiral Curl Perm", description: "Defined springy spiral curls from root to tip on 8 cm top hair, rounded curly silhouette, tapered sides, separated curl clumps with hydrated shine, clearly permed texture", imageUrl: L("men/spiral-curl-perm.jpg") },
      { section: "Perms", name: "Twist Spiral Perm", description: "Medium 9 cm hair with irregular twist-spiral curls and messy directional movement, textured fringe, low taper around the ears, edgy Japanese street-style finish", imageUrl: L("men/twist-spiral-perm.jpg") },
      { section: "Perms", name: "C-Curl Curtain Perm", description: "Medium curtain hairstyle with center parting, front pieces bent into smooth C-shaped curves away from the face, subtle root lift, soft glossy Korean salon finish", imageUrl: L("men/c-curl-curtain-perm.jpg") },
      { section: "Perms", name: "Hippie Curl Perm", description: "Medium-long layered hair with dense small loose curls all over, full rounded volume around the face, natural frizz-controlled texture, retro bohemian salon style", imageUrl: L("men/hippie-curl-perm.jpg") },
      { section: "Perms", name: "Permed Two-Block", description: "Two-block haircut with short hidden sides and a longer 8 cm top permed into soft loose waves, curtain fringe falling over the forehead, airy K-pop volume and texture", imageUrl: L("men/permed-two-block.jpg") },
      { section: "Perms", name: "Permed Mullet", description: "Layered mullet with wavy permed top and crown, textured fringe, sides tapered around the ears, back left longer to the collar with loose curls and controlled volume", imageUrl: L("men/permed-mullet.jpg") },
      { section: "Perms", name: "Root Lift Comma Perm", description: "Subtle root-lift perm with a comma-shaped fringe, loose C-bends through the front, soft crown volume, low tapered sides, airy Korean salon movement", imageUrl: L("men/root-lift-comma-perm.jpg") },
      { section: "Modern Barbershop", name: "Edgar Cut", description: "Flat blunt fringe cut straight across the forehead with no taper, mid skin fade on the sides, sharp lined-up hairline, modern Latin-American barbershop style", imageUrl: L("men/edgar-cut.jpg") },
      { section: "Modern Barbershop", name: "Slick-Back Pompadour", description: "Glossy hair on top about 10 cm long combed up and back with strong volume above the forehead, tight tapered fade on the sides, sharp shaved side parting line, vintage gentleman finish", imageUrl: L("men/slick-back-pompadour.webp") },
      { section: "Modern Barbershop", name: "Textured French Crop", description: "Short forward-swept fringe with piecey separated strands on top about 4 cm, mid drop fade on the sides and back, matte natural finish, modern European barbershop", imageUrl: L("men/textured-french-crop.webp") },
      { section: "Modern Barbershop", name: "Classic Side Part", description: "Hair on top about 4 cm combed neatly to one side over a deep parting line, scissor-cut tapered sides blending into a natural neckline, polished business style", imageUrl: L("men/classic-side-part.jpg") },
      { section: "Modern Barbershop", name: "Regent Cut", description: "Korean regent cut with the front lifted upward and brushed back, controlled 7 cm top volume, tight tapered sides, clean temple line, neat satin finish", imageUrl: L("men/regent-cut.jpg") },
      { section: "Modern Barbershop", name: "Drop Fade Textured Top", description: "Short textured dark top with choppy matte separation, curved drop fade dipping behind the ears, clean neckline taper, sharp but wearable barbershop shape", imageUrl: L("men/drop-fade-textured-top.jpg") },
      { section: "Modern Barbershop", name: "Taper Fade Crop", description: "Compact cropped top about 4 cm with piecey forward fringe, smooth taper fade around the ears and neckline, natural dark matte texture, clean salon-barber finish", imageUrl: L("men/taper-fade-crop.jpg") },
      { section: "Modern Barbershop", name: "Side-Swept Undercut", description: "Long 10 cm top swept dramatically to one side, clean undercut sides, diagonal front flow, exposed temple line, controlled dark hair with satin finish", imageUrl: L("men/side-swept-undercut.jpg") },
      { section: "Short & Clean", name: "Buzz Cut", description: "Uniform 3 mm clipper length all over the head, scalp lightly visible through the hair, sharp natural front hairline at the forehead, completely flat with no styling", imageUrl: L("men/buzz-cut.webp") },
      { section: "Short & Clean", name: "Caesar Cut", description: "Short even 2 cm hair all over the head, straight blunt fringe across the forehead, classic Roman-style horizontal hairline", imageUrl: L("men/caesar-cut.jpg") },
      { section: "Long & Textured", name: "Curly Afro Taper", description: "Defined springy 8 cm coils on top with even volume all around the head, clean tapered sideburns and neckline, neat rounded silhouette, natural black hair", imageUrl: L("men/curly-afro-taper.webp") },
      { section: "Long & Textured", name: "Man Bun Undercut", description: "Long hair pulled tightly into a smooth bun at the back of the crown, shaved undercut from ear to ear, exposed temples and nape, no flyaways", imageUrl: L("men/man-bun-undercut.webp") },
      { section: "Long & Textured", name: "90s Curtain Hair", description: "Shoulder-length straight hair parted in the middle, soft curtain bangs framing both sides of the face, slightly tousled ends, 1990s Leonardo DiCaprio vibe", imageUrl: L("men/90s-curtain-hair.webp") },
      { section: "Edgy & Statement", name: "Mohawk", description: "Sides shaved down to skin from temple to nape, central strip of upright hair about 7 cm tall styled into vertical spikes, sharp geometric outline", imageUrl: L("men/mohawk.jpg") },
      { section: "Modern Barbershop", name: "Low Taper Textured Crop", description: "Short choppy top about 4 cm with forward movement and piecey texture, low taper fade starting just above the ears, clean natural neckline, matte styling cream finish", imageUrl: L("men/low-taper-textured-crop.jpg") },
      { section: "Modern Barbershop", name: "Messy Fringe Low Fade", description: "Medium top about 6 cm pushed forward into a messy broken fringe over the forehead, low fade around the ears, soft natural crown volume, dry matte texture", imageUrl: L("men/messy-fringe-low-fade.jpg") },
      { section: "Modern Barbershop", name: "Textured Quiff Fade", description: "Top hair about 8 cm blow-dried upward into a loose quiff, choppy separated texture through the front, mid fade on the sides, clean temple line, satin finish", imageUrl: L("men/textured-quiff-fade.jpg") },
      { section: "Modern Barbershop", name: "Comb Over Skin Fade", description: "Deep side part with 6 cm top hair combed diagonally back, high skin fade blended tightly from the temples, sharp hairline lineup, smooth medium-shine pomade finish", imageUrl: L("men/comb-over-skin-fade.jpg") },
      { section: "Modern Barbershop", name: "Hard Part Fade", description: "Razor-sharp shaved side part line, top hair about 5 cm combed neatly to one side, tight mid fade on the sides and back, crisp square hairline, polished barbershop finish", imageUrl: L("men/hard-part-fade.jpg") },
      { section: "Short & Clean", name: "High and Tight", description: "Very short 6 mm top with high clipper fade taken close to the scalp on the sides, clean military-inspired outline, natural front hairline, no styling volume", imageUrl: L("men/high-and-tight.jpg") },
      { section: "Short & Clean", name: "Crew Cut Taper", description: "Short 2 cm top slightly longer at the front, scissor-textured crown, soft taper around the ears and neckline, practical athletic shape, natural matte finish", imageUrl: L("men/crew-cut-taper.jpg") },
      { section: "Short & Clean", name: "Crew Cut", description: "Clean Korean crew cut with short dark top about 2 cm, slightly textured front, even clipper-tight sides, neat natural hairline, athletic matte finish", imageUrl: L("men/crew-cut.jpg") },
      { section: "Short & Clean", name: "Ivy League Taper", description: "Neat 4 cm top brushed to the side with a short collegiate front lift, low scissor taper through the sides, natural neckline, tidy classic barbershop look", imageUrl: L("men/ivy-league-taper.jpg") },
      { section: "Short & Clean", name: "Temple Fade Waves", description: "Short black hair brushed into visible 360 wave pattern, temple fade blended around the sideburns, clean neckline taper, sharp edge-up around the forehead", imageUrl: L("men/temple-fade-waves.jpg") },
      { section: "Short & Clean", name: "Afro Shape-Up", description: "Compact natural afro about 5 cm tall with rounded even volume, crisp square shape-up at the forehead and temples, softly tapered sideburns and neckline", imageUrl: L("men/afro-shape-up.jpg") },
      { section: "Long & Textured", name: "Modern Bro Flow", description: "Medium-long hair about 12 cm swept backward away from the face, natural waves flowing over the ears, soft scissor-cut layers, relaxed surfer finish with no hard part", imageUrl: L("men/modern-bro-flow.jpg") },
      { section: "Long & Textured", name: "Scissor Cut Medium Flow", description: "All-scissor medium cut with 9 cm layered top and sides, natural side-swept movement, ears partly covered, soft feathered neckline, clean salon-barber hybrid finish", imageUrl: L("men/scissor-cut-medium-flow.jpg") },
      { section: "Long & Textured", name: "Middle Part Flow", description: "Medium-length middle part with flowing curtain pieces, soft layers over the ears, gentle movement at the cheekbones, natural dark shine and relaxed Korean salon finish", imageUrl: L("men/middle-part-flow.jpg") },
      { section: "Long & Textured", name: "Shoulder-Length Layers", description: "Straight to wavy hair reaching the shoulders, center parting, long face-framing layers starting at the cheekbones, soft tucked-behind-ear shape, natural shine", imageUrl: L("men/shoulder-length-layers.jpg") },
      { section: "Long & Textured", name: "Disconnected Undercut", description: "Long 12 cm top swept dramatically back from the forehead, shaved undercut sides with a visible disconnected line, full top volume, sleek controlled finish", imageUrl: L("men/disconnected-undercut.jpg") },
      { section: "Long & Textured", name: "Samurai Top Knot", description: "Long top hair tied into a small knot high at the back of the crown, sides tightly faded from temple to nape, clean exposed hairline, smooth gathered roots", imageUrl: L("men/samurai-top-knot.jpg") },
      { section: "Curly & Coily", name: "Curly Burst Fade", description: "Defined natural curls about 7 cm tall on top, curved burst fade around the ears, tapered neckline, curls kept rounded and separated with hydrated shine", imageUrl: L("men/curly-burst-fade.jpg") },
      { section: "Curly & Coily", name: "Burst Fade", description: "Curved burst fade wrapping cleanly around both ears, textured dark top about 5 cm with natural movement, tapered neckline, sharp temple edge and matte salon finish", imageUrl: L("men/burst-fade.jpg") },
      { section: "Curly & Coily", name: "Coily High Top Fade", description: "Dense coily high top about 9 cm tall with a flat softly squared crown, high fade on the sides, crisp lineup at the forehead and temples, clean geometric silhouette", imageUrl: L("men/coily-high-top-fade.jpg") },
      { section: "Curly & Coily", name: "Loose Curl Taper", description: "Loose medium curls about 8 cm long falling naturally forward, low taper around the ears and neckline, rounded top shape, no shaved hard lines, soft natural finish", imageUrl: L("men/loose-curl-taper.jpg") },
      { section: "Edgy & Statement", name: "Burst Fade Mullet", description: "Choppy textured top with short fringe, curved burst fade around both ears, back kept longer to the collar in a controlled mullet shape, matte messy finish", imageUrl: L("men/burst-fade-mullet.jpg") },
      { section: "Edgy & Statement", name: "Faux Hawk Fade", description: "Hair styled upward into a narrow textured ridge from forehead to crown, mid fade sides, back kept short and clean, spiky matte finish without a full shaved mohawk", imageUrl: L("men/faux-hawk-fade.jpg") },
    ],
    woman: [
      { section: "Asian-Inspired", name: "Korean Curly Perm", description: "Shoulder-length S-curl perm with soft loose curls, full volume around the face, middle-parted curtain bangs, glossy chestnut brown tone, Korean salon style", imageUrl: L("women/korean-curly-perm.jpg") },
      { section: "Asian-Inspired", name: "Hime Cut", description: "Long straight jet-black hair past the shoulder blades, blunt cheek-length front side strands cut sharply at the cheekbone, straight blunt fringe across the forehead, geometric Japanese princess outline", imageUrl: L("women/hime-cut.jpg") },
      { section: "Bobs & Lobs", name: "French Bob", description: "Chin-length blunt bob with a soft inward bend at the ends, blunt micro-bangs sitting just above the eyebrows, polished Parisian finish, dark brown", imageUrl: L("women/french-bob.jpg") },
      { section: "Bobs & Lobs", name: "Sleek Glass Bob", description: "Sharp chin-length blunt bob cut perfectly straight across, mirror-like glassy shine, deep side parting, sleek tucked behind one ear, no layers", imageUrl: L("women/sleek-glass-bob.jpg") },
      { section: "Bobs & Lobs", name: "Curtain Bangs Lob", description: "Shoulder-length lob with a soft inward bend at the ends, middle-parted curtain bangs framing the cheekbones, subtle face-framing layers, lived-in caramel balayage", imageUrl: L("women/curtain-bangs-lob.jpg") },
      { section: "Long & Wavy", name: "Beach Waves", description: "Long loose S-shaped waves falling past the chest, sun-kissed caramel highlights, middle parting, soft face-framing layers around the cheekbones, glossy ends", imageUrl: L("women/beach-waves.jpg") },
      { section: "Long & Wavy", name: "Long Sleek Straight", description: "Jet-flat poker-straight hair down to the lower back, center parting, blunt straight ends, mirror-like glassy shine from root to tip", imageUrl: L("women/long-sleek-straight.jpg") },
      { section: "Long & Textured", name: "Voluminous Curls", description: "Tight defined ringlet curls at shoulder length, wide halo of volume all around the head, no visible parting, frizz-free hydrated finish", imageUrl: L("women/voluminous-curls.jpg") },
      { section: "Long & Textured", name: "Wolf Cut", description: "Heavy shaggy collarbone-length layers, choppy curtain bangs, lots of texture and volume around the crown, undone rocker energy, lived-in dark brown", imageUrl: L("women/wolf-cut.jpg") },
      { section: "Short & Edgy", name: "Pixie Cut", description: "Hair about 4 cm long on top, very short tapered sides and nape, long side-swept fringe sweeping across the forehead to one eyebrow, edgy modern silhouette", imageUrl: L("women/pixie-cut.jpg") },
      { section: "Updos & Braids", name: "High Slick Ponytail", description: "Slicked-back high ponytail tied at the very crown of the head, glassy roots with zero flyaways, long polished ponytail reaching past the shoulder blades", imageUrl: L("women/high-slick-ponytail.jpg") },
      { section: "Updos & Braids", name: "Box Braids", description: "Long thin box braids reaching the lower back, neat parted small square sections visible at the scalp, braids gathered loosely behind the shoulders, natural black", imageUrl: L("women/box-braids.jpg") },
      { section: "Asian-Inspired", name: "Airy Korean Layer Cut", description: "Long chest-length hair with soft airy face-framing layers starting below the cheekbones, center parting, feathered ends curved inward, glossy dark brown Korean salon finish", imageUrl: L("women/airy-korean-layer-cut.jpg") },
      { section: "Asian-Inspired", name: "Soft C-Curl Lob", description: "Collarbone-length lob with smooth C-shaped inward curls at the ends, see-through wispy fringe across the forehead, subtle volume at the crown, polished chestnut tone", imageUrl: L("women/soft-c-curl-lob.jpg") },
      { section: "Bobs & Lobs", name: "Italian Bob", description: "Jaw-length full bob with rounded volume, ends slightly beveled under the chin, soft side parting, thick healthy silhouette, glossy espresso brown finish", imageUrl: L("women/italian-bob.jpg") },
      { section: "Bobs & Lobs", name: "Clavicut", description: "Blunt collarbone-length cut sitting exactly at the clavicles, long invisible layers through the ends, center parting, smooth straight finish with natural movement", imageUrl: L("women/clavicut.jpg") },
      { section: "Bobs & Lobs", name: "Curly Lob", description: "Shoulder-skimming lob shaped around natural curls, defined curl clumps with rounded sides, subtle long layers to prevent triangle shape, hydrated frizz-free finish", imageUrl: L("women/curly-lob.jpg") },
      { section: "Long & Wavy", name: "Butterfly Layers", description: "Long hair falling past the chest with two-tier butterfly layers, shorter face-framing pieces sweeping away from the cheeks, bouncy blowout volume, soft caramel dimension", imageUrl: L("women/butterfly-layers.jpg") },
      { section: "Long & Wavy", name: "Mermaid Waves", description: "Very long hair past the waist with uniform loose waves from mid-length to ends, center parting, soft glossy texture, subtle sunlit balayage through the lower half", imageUrl: L("women/mermaid-waves.jpg") },
      { section: "Long & Wavy", name: "Old Hollywood Waves", description: "Deep side part with large sculpted S-waves cascading over one shoulder, polished shoulder-to-chest length, smooth glossy surface, elegant red-carpet finish", imageUrl: L("women/old-hollywood-waves.jpg") },
      { section: "Long & Wavy", name: "Long Layers with Money Piece", description: "Long layered hair past the chest with face-framing layers starting at the chin, bright front money-piece highlights, softly curled ends, dimensional brunette base", imageUrl: L("women/long-layers-with-money-piece.jpg") },
      { section: "Long & Textured", name: "Muted Shag", description: "Soft shag haircut at collarbone length with blended razored layers, airy curtain fringe, tousled waves, moderate crown lift, wearable undone texture", imageUrl: L("women/muted-shag.jpg") },
      { section: "Long & Textured", name: "Octopus Cut", description: "Long layered cut with rounded shorter crown layers creating volume on top, thin longer tentacle-like lengths falling past the shoulders, wispy face-framing fringe", imageUrl: L("women/octopus-cut.jpg") },
      { section: "Long & Textured", name: "Jellyfish Cut", description: "Sharp two-level haircut with a blunt chin-length bob layer on top and long straight underlayer falling past the shoulders, strong graphic separation, sleek black finish", imageUrl: L("women/jellyfish-cut.jpg") },
      { section: "Long & Textured", name: "Modern Mullet Shag", description: "Shoulder-length shag-mullet hybrid with heavy crown layers, shorter textured sides, longer tapered back, choppy eyebrow-length fringe, edgy salon finish", imageUrl: L("women/modern-mullet-shag.jpg") },
      { section: "Short & Edgy", name: "Bixie Cut", description: "Hybrid bob-pixie cut with cropped nape, soft ear-grazing sides, longer layered crown about 6 cm, feathered side fringe, lightweight textured movement", imageUrl: L("women/bixie-cut.jpg") },
      { section: "Short & Edgy", name: "Shaggy Pixie", description: "Short pixie with razored uneven layers, piecey fringe across the forehead, tapered nape, textured crown volume, matte lived-in styling", imageUrl: L("women/shaggy-pixie.jpg") },
      { section: "Short & Edgy", name: "Side-Swept Pixie", description: "Very short tapered sides and nape with a long smooth fringe sweeping diagonally across one eyebrow, sleek side part, polished modern silhouette", imageUrl: L("women/side-swept-pixie.jpg") },
      { section: "Bangs & Fringe", name: "Wispy Birkin Bangs", description: "Long hair with soft eyebrow-grazing wispy bangs, slightly parted center pieces, gentle face-framing layers, natural medium-brown texture, not blunt or heavy", imageUrl: L("women/wispy-birkin-bangs.jpg") },
      { section: "Bangs & Fringe", name: "Blunt Bangs Long Layers", description: "Long straight hair past the chest with full blunt bangs cut straight across at eyebrow level, subtle long layers through the ends, glassy smooth finish", imageUrl: L("women/blunt-bangs-long-layers.jpg") },
      { section: "Updos & Braids", name: "Crown Braid Updo", description: "Thick braid wrapped around the crown like a halo, smooth tucked ends hidden at the back, a few soft face-framing wisps, elegant salon updo", imageUrl: L("women/crown-braid-updo.jpg") },
      { section: "Updos & Braids", name: "Fulani Braids", description: "Neat center-parted cornrows braided close to the scalp with long braids falling over the shoulders, small accent braids framing the face, clean geometric parting", imageUrl: L("women/fulani-braids.jpg") },
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
