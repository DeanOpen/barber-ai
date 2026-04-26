# CLAUDE.md

Durable working context for future agents in this repository. Keep this short and update it when behavior changes across kiosk, admin, generation, deployment, privacy, or documentation.

## Product Truth

Barber Studio is a private in-shop AI hairstyle preview station for barbers and salons. It is a chair-side consultation tool, not a booking platform, marketplace, or multi-tenant SaaS product.

Prefer direct, operator-friendly changes over broad platform abstractions.

## Modes

- Shop kiosk mode is default. Server owns the provider key, `/admin` is enabled, generation runs through API routes, settings live in `data/settings.json`, and job history lives under `data/jobs/`.
- Public showcase mode is built with `NEXT_PUBLIC_SHOWCASE=1`. Admin and server generation return `410`; the browser stores a visitor key in `localStorage` and calls the provider directly.

Keep these modes separate. Generation, settings, watermarking, and storage changes usually need an explicit check for both paths.

## High-Leverage Files

- `app/page.tsx`: kiosk wizard, customer tabs, style picker, SSE streams, reload resume, showcase flow.
- `app/admin/page.tsx`: login, provider settings, catalog editor, watermark, category images, password, history UI.
- `app/components/FaceCapture.tsx`: camera/upload capture and square normalization.
- `app/components/ShowcaseSetup.tsx`: public BYOK provider settings.
- `app/theme.tsx`: Ant Design dark theme tokens.
- `app/globals.css`: kiosk/admin visual classes and CSS variables.
- `lib/defaults.ts`: seed catalog, public defaults, category images, public types.
- `lib/settings.ts`: settings file creation, migration, defaults, public setting stripping.
- `lib/jobs.ts`: job lifecycle, persistence, event bus, rehydration, cleanup.
- `lib/history.ts`: admin history reads and delete.
- `lib/generate-runner.ts`: server provider calls, prompts, image extraction, watermark.
- `lib/client-generate.ts`: showcase browser provider calls.
- `lib/prompts.ts`: browser-safe prompt builders; keep aligned with server prompt changes.

## Package and Deploy Truth

- Package manager is Yarn 4. Use `corepack enable` and `yarn install` locally; CI should keep using an immutable install.
- `nodeLinker: node-modules` is set in `.yarnrc.yml`.
- Docker standalone remains the packaged container path.
- OpenNext/Cloudflare scripts exist in `package.json`: `build`, `preview`, `deploy`, `deploy:full`, `deploy:only`, and `cf-typegen`. They still require the correct Cloudflare account/project configuration outside the app code.

## Editing Rules

- Preserve compact Ant Design admin styling. Admin is an operational tool, not a glossy landing page.
- Kiosk UI can be visual, but selection, capture, progress, retry, save, and present must stay clear.
- Keep copy practical and shop-facing.
- Do not commit or document real secrets.
- Keep `data/settings.json`, `data/jobs/`, `.env`, `.env.local`, `.next/`, and build artifacts out of git.
- If prompt strategy changes, update both `lib/generate-runner.ts` and `lib/prompts.ts` or document the intentional split.
- If data retention changes, update `README.md`, `PROJECT_OVERVIEW.md`, and this file.
- If API routes change, update route tables in `README.md` and `PROJECT_OVERVIEW.md`.
- If deployment/env behavior changes, update `.env.local.example`, `docker-compose.yml`, `Dockerfile`, CI, `README.md`, and `PROJECT_OVERVIEW.md` together.

## Adding Hairstyles

Production path: use `/admin` -> Hairstyle prompts and save rows into `data/settings.json`.

Seed catalog path: edit `PUBLIC_DEFAULTS.prompts` in `lib/defaults.ts`. Add local picker images under `public/style-references/<category>/` and point `imageUrl` at `/style-references/...`.

Good rows are concrete: length, shape, fade/taper, fringe, part, volume, texture, color, finish, and exclusions. Avoid vague style-only prompts.

## Data and Privacy

Shop mode stores customer photos and generated previews under `data/jobs/` for admin history. Treat that folder as sensitive customer data.

Public showcase mode should not read or write shop data. Visitor key and provider settings live only in browser `localStorage`.

## Generation Notes

- Individual mode creates one item per selected style.
- Grid mode creates one composite lookbook item, then allows limited full-detail renders.
- Server concurrency defaults to 3 and clamps between 1 and 6.
- Models with `/` in the id use chat-completions image/modalities path.
- Other models use images edit path.
- Watermark helpers should return the original image if watermarking fails.

## Admin/Auth Notes

Admin auth is one shared password:

- saved in `data/settings.json`,
- compared directly on login,
- represented in a cookie as `sha256("barber:" + password)`,
- invalidated when the password changes.

Do not describe this as enterprise auth. If public exposure increases, add rate limiting, stronger auth, consent/storage policy, and CSRF protection.

## Verification

Preferred checks:

```bash
yarn typecheck
yarn build:next
yarn build
git diff --check
```

`yarn build:next` checks the app without the OpenNext step. `yarn build` runs the current full build script. `yarn lint` is best-effort while it still points at `next lint`.

## Documentation Contract

- `README.md` is the operator and contributor entry point.
- `PROJECT_OVERVIEW.md` is the deeper technical and business architecture map.
- `CLAUDE.md` is the agent memory surface.

Keep all three current when cross-cutting behavior changes.
