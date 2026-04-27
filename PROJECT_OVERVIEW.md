# Barber Studio Project Overview

This is the deeper product and technical map for the repository. Keep it aligned with `README.md` and `CLAUDE.md` whenever the operating model changes.

## Product Position

Barber Studio is a single-shop hairstyle consultation tool. It helps staff show realistic haircut options before the cut starts, reduce wrong-style surprises, and create branded preview assets the shop can save or present.

The product is intentionally narrow:

- private shop kiosk first,
- owner-managed style catalog,
- one shared admin password,
- file-backed settings and history,
- no booking, payments, marketplace, tenant model, or account system.

## Stack

| Layer | Current choice |
| --- | --- |
| Framework | Next.js 15.5.15 App Router |
| React | React 19 |
| Language | TypeScript 5 |
| Package manager | Yarn 4.9.1 with `nodeLinker: node-modules` |
| UI | Ant Design 5, `@ant-design/nextjs-registry`, React 19 patch |
| Styling | Tailwind CSS 4 import plus custom CSS variables/classes |
| Image provider | OpenAI SDK 4.x against OpenAI or OpenAI-compatible `baseURL` |
| Server image work | Sharp for watermarking |
| Storage | Local JSON and files under `data/` |
| Runtime deploy | Docker standalone output on Node 20 Alpine; OpenNext Cloudflare scripts are also present |
| CI | CircleCI and GitHub Actions |

Docker remains the packaged container path. `package.json` also includes OpenNext/Cloudflare scripts for build, preview, deploy, and Wrangler type generation; those scripts still require the correct Cloudflare account/project configuration outside the app code.

## Runtime Modes

### Shop Kiosk

Shop kiosk is the normal mode.

- `/` serves the customer/stylist workflow.
- `/admin` is enabled.
- `/api/generate*` runs on the server.
- Provider key and settings are stored in `data/settings.json`.
- Customer input and generated images are stored under `data/jobs/`.
- Watermarking happens server-side with Sharp.

### Public Showcase

Public showcase is selected with `NEXT_PUBLIC_SHOWCASE=1` at build time.

- `/` still serves the wizard.
- `/admin`, `/api/admin/*`, and `/api/generate*` return `410 Gone`.
- `/api/status` returns static public defaults.
- The visitor enters an OpenAI-compatible key in the browser.
- The key and provider settings stay in browser `localStorage`.
- Provider calls and watermarking happen in the browser.
- The server does not read or write `data/`.

Do not mix these modes. Any feature touching generation, settings, or storage should check whether it needs a separate showcase path.

## Main Journeys

### Shop Owner

1. Deploy with Docker or run locally.
2. Open `/admin`.
3. Sign in with `ADMIN_PASSWORD` or `change-me` on first run.
4. Configure provider key, optional `baseURL`, model, mode, image count, size, quality, watermark, category images, style catalog, and password.
5. Use History to inspect or delete persisted customer sessions.

### Stylist / Customer

1. Open `/`.
2. Pick or add a customer tab.
3. Choose Men, Women, or Kids.
4. Pick styles grouped by catalog section.
5. Capture a square camera photo or upload an image.
6. Start generation.
7. Watch cards update over SSE.
8. Retry failures, request grid detail renders, save images, or present the slideshow.

### Public Demo Visitor

1. Open a showcase build.
2. Paste an API key into the BYOK modal.
3. Pick styles and add a photo.
4. The browser calls the provider directly.

## Source Map

| Area | Files | Responsibility |
| --- | --- | --- |
| Shell/layout | `app/layout.tsx`, `app/theme.tsx`, `app/globals.css` | Page shell, Ant Design dark theme, global kiosk/admin styling. |
| Kiosk workflow | `app/page.tsx` | Wizard state, customer tabs, style selection, job start, SSE resume, showcase flow. |
| Capture | `app/components/FaceCapture.tsx` | Camera, upload, square crop, selfie unmirror, stream cleanup. |
| Presentation | `app/components/Slideshow.tsx` | Full-screen lookbook navigation and image saving. |
| Category cards | `app/components/PhotoCard.tsx` | Men/Women/Kids selection cards. |
| Showcase setup | `app/components/ShowcaseSetup.tsx` | Browser-side provider config for public demo mode. |
| Admin | `app/admin/page.tsx` | Login, provider settings, watermark, category images, style catalog, password, history. |
| Defaults | `lib/defaults.ts` | Client-safe defaults, style catalog seed data, category images, public types. |
| Settings | `lib/settings.ts` | Settings file creation, migration, merge defaults, public setting stripping. |
| Auth | `lib/auth.ts` | Shared-password admin cookie. |
| Jobs | `lib/jobs.ts` | In-memory job map, disk state, event bus, rehydration, TTL cleanup. |
| History | `lib/history.ts` | Admin history listing, input reads, output reads, deletion. |
| Server generation | `lib/generate-runner.ts` | Server provider calls, image extraction, status updates, server watermark. |
| Showcase generation | `lib/client-generate.ts` | Browser provider calls, browser job items, client watermark. |
| Prompt templates | `lib/prompts.ts` | Browser-safe prompt builders used by showcase flow. |
| Mode flag | `lib/showcase.ts` | `NEXT_PUBLIC_SHOWCASE === "1"`. |

## Settings Model

`data/settings.json` is the only shop configuration store.

```ts
type Settings = {
  apiKey: string;
  baseURL: string;
  adminPassword: string;
  model: string;
  mode: "individual" | "grid";
  imageCount: number;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality: "low" | "medium" | "high" | "auto";
  watermark: {
    enabled: boolean;
    text: string;
    position: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "bottom-center";
    opacity: number;
    size: number;
    color: string;
  };
  prompts: Record<"man" | "woman" | "kid", Array<{
    section?: string;
    name: string;
    description: string;
    imageUrl?: string;
  }>>;
  categoryImages: Record<"man" | "woman" | "kid", string>;
};
```

Important behavior:

- `ensureFile()` creates `data/settings.json` from defaults on first read.
- `ADMIN_PASSWORD` only matters before `data/settings.json` exists.
- Old string-only prompt arrays migrate into `{ name, description }` rows.
- Empty prompt groups fall back to defaults.
- Empty category images fall back to defaults.
- Invalid watermark values fall back to safe defaults.
- `/api/status` strips secrets and watermark data in shop mode.
- Showcase mode skips `data/settings.json` and returns `PUBLIC_DEFAULTS`.

## Hairstyle Catalog

Each hairstyle row has a section, name, optional reference image, and prompt description.

Admin edits are the normal production path. They are saved in `data/settings.json`.

Seed defaults for new installs live in `lib/defaults.ts`:

- `PUBLIC_DEFAULTS.prompts.man`
- `PUBLIC_DEFAULTS.prompts.woman`
- `PUBLIC_DEFAULTS.prompts.kid`

Local picker images belong under `public/style-references/`. The current repo has local men reference images and URL-based category images. Women and kids styles currently rely on text descriptions unless an admin or developer adds `imageUrl` values.

Good style rows describe visible hair facts: length, shape, fade/taper, fringe, part, volume, texture, color, finish, and any hard exclusion. The model performs better with concrete visual constraints than broad trend names.

## Job Model

`POST /api/generate` creates a job and returns immediately.

```ts
type Job = {
  id: string;
  createdAt: number;
  updatedAt: number;
  gender: "man" | "woman" | "kid";
  mode: "individual" | "grid";
  picks: Array<{ name: string; description: string }>;
  items: JobItem[];
  done: boolean;
};

type JobItem = {
  name: string;
  description: string;
  status: "pending" | "running" | "done" | "failed";
  b64?: string | null;
  error?: string;
  kind?: "single" | "grid";
  gridStyles?: Array<{ name: string; description: string }>;
};
```

Persistence:

- Active jobs live on `globalThis.__barberJobs__` to survive `next dev` hot reload.
- Every job is also written to `data/jobs/<id>/`.
- `input.bin` stores the uploaded customer photo.
- `input.meta.json` stores the input MIME type.
- `state.json` stores item status and generated base64 output.
- Memory entries are cleaned after about 1 hour.
- Disk job folders are cleaned after about 30 days.

Rehydration:

- `HEAD /api/generate/[id]/stream` checks whether a job exists.
- `GET /api/generate/[id]/stream` can rehydrate from disk after restart.
- Any `pending` or `running` items found after restart are marked failed.
- Completed items stay available for snapshots and admin history.

## Generation Modes

### Individual

- One selected style becomes one job item.
- The runner calls the provider once per style.
- Server concurrency defaults to 3 and is clamped between 1 and 6.
- The picker allows up to 6 selected styles.

### Grid

- Selected styles become one `grid` job item.
- The runner asks for a single labeled composite lookbook.
- The picker allows up to 12 styles.
- Customers can request full-detail single renders from grid picks.
- Detail renders are capped by `MAX_DETAILS_PER_JOB` in the route code.

## Provider Calls

`lib/generate-runner.ts` supports two provider call shapes:

- Model ids without `/` use `client.images.edit(...)`.
- Model ids with `/` use `client.chat.completions.create(...)` with image/text modalities for OpenRouter-style model ids.

The optional `baseURL` lets the same flow target OpenAI-compatible providers. If a provider returns text or no image payload, the runner stores a diagnostic error on the failed item.

Prompt intent:

- preserve identity, age, face shape, facial features, pose, gaze, skin tone, and ethnicity,
- replace the hairstyle completely,
- avoid blending old and new hair,
- produce a professional head-and-shoulders barbershop or salon image,
- label cells only in grid mode.

Server prompts are currently duplicated in `lib/generate-runner.ts` and `lib/prompts.ts`. Keep them aligned when changing prompt strategy.

## Provider Costs

Default model is OpenAI `gpt-image-2`. Per-image output cost is roughly $0.006 (`low`), $0.05 (`medium`), or $0.21 (`high`) at 1024×1024; rectangular sizes are slightly cheaper. Image and text inputs add fractions of a cent per call. See the Provider Costs table in `README.md` for the operator-facing breakdown and current OpenAI pricing link.

The default settings (`high` quality, `1024x1024`) prioritize preview fidelity over price. Shops watching spend should drop quality to `medium` in `/admin` before changing model id or provider.

## API Routes

| Route | Methods | Auth | Showcase | Notes |
| --- | --- | --- | --- | --- |
| `/api/status` | `GET` | none | enabled | Returns public/default status and `showcase` flag. |
| `/api/generate` | `POST` | none | `410` | Multipart form with `image`, `gender`, optional `count`, repeated `styles`. |
| `/api/generate/[id]/stream` | `HEAD`, `GET` | none | `410` | HEAD probes existence; GET streams SSE events. |
| `/api/generate/[id]/retry` | `POST` | none | `410` | Body `{ name }`; reruns a matching item. |
| `/api/generate/[id]/detail` | `POST` | none | `410` | Body `{ name }`; appends one render from grid picks. |
| `/api/admin/login` | `POST`, `DELETE` | password/cookie | `410` | Creates or clears `barber_admin`. |
| `/api/admin/settings` | `GET`, `POST` | admin | `410` | Full settings read/write. |
| `/api/admin/history` | `GET` | admin | `410` | Lists persisted jobs newest first. |
| `/api/admin/history/[id]` | `DELETE` | admin | `410` | Deletes job folder. |
| `/api/admin/history/[id]/input` | `GET` | admin | `410` | Returns original input image. |
| `/api/admin/history/[id]/items/[idx]` | `GET` | admin | `410` | Returns generated PNG for a done item. |

## Frontend State

`app/page.tsx` owns the customer workflow:

- `customers` stores independent customer tabs.
- `activeId` selects the current tab.
- `EventSource` objects are stored by customer id.
- Switching tabs does not close active job streams.
- Shop-mode job metadata is mirrored to `localStorage` under `barber.customers.v2`.
- On reload, the app HEAD-probes stream URLs and reconnects valid jobs.
- Showcase mode skips server jobs and uses browser abort controllers.

The wizard gates forward movement:

- style selection requires a customer type,
- face capture requires selected styles,
- lookbook requires a job.

## Admin Behavior

`app/admin/page.tsx` is a compact Ant Design admin surface:

- shared-password login,
- API key, host, model, mode, count, size, and quality settings,
- watermark settings,
- category image URLs,
- hairstyle rows grouped by Men/Women/Kids,
- password change,
- persisted history with input/output previews and delete controls.

The browser caches provider fields under `barber.admin.byok.v1` so a shop owner can recover typed key/model values after a reload.

## Styling System

`app/theme.tsx` sets Ant Design dark tokens:

- primary/info amber,
- dark base/container/elevated backgrounds,
- compact border radius,
- system font stack.

`app/globals.css` provides app-specific CSS variables and classes for:

- sticky shop header,
- brand mark,
- kiosk hero/card surfaces,
- face capture and camera overlay,
- category cards,
- style picker cards,
- lookbook cards.

When adding UI:

- keep admin compact and operational,
- use Ant Design controls for forms, tabs, tables, cards, alerts, tags, and messages,
- avoid marketing-style copy inside admin flows,
- keep kiosk cards visual enough for chair-side selection,
- keep text short enough for mobile cards,
- use existing color variables before adding new palette values.

## Auth and Security

Admin auth is intentionally simple:

- password is stored in `data/settings.json`,
- login compares plaintext password to the saved value,
- cookie value is `sha256("barber:" + password)`,
- cookie is `httpOnly`, `sameSite=lax`, `secure` in production, path `/`, 7-day lifetime,
- changing the admin password invalidates old cookies.

Security constraints:

- suitable for private single-shop deployment,
- no RBAC,
- no rate limiting,
- no queue dashboard,
- no CSRF token,
- secrets and customer data are plaintext on disk.

Do not describe this as enterprise auth. If public exposure increases, add stronger auth, consent/storage policy, rate limiting, and CSRF protection.

## Build and Deployment

`next.config.ts` sets:

- `output: "standalone"`,
- server action body size limit `20mb`.

`Dockerfile`:

- installs with Yarn,
- runs `yarn build:next`, which produces the standalone Next.js server used by the Docker image,
- copies `.next/standalone`, `.next/static`, and `public`,
- runs as non-root `nextjs`,
- declares `/app/data` as a volume,
- exposes port `3000`,
- healthchecks `/api/status`.

`docker-compose.yml`:

- runs `deanopen/barber-ai:${BARBER_IMAGE_TAG:-latest}`,
- maps `${BARBER_PORT:-3000}:3000`,
- sets `OPENAI_API_KEY`, `ADMIN_PASSWORD`, and `NEXT_PUBLIC_SHOWCASE`,
- mounts `barber-data:/app/data`.

## CI/CD

Two pipelines exist:

- `.circleci/config.yml`
- `.github/workflows/ci.yml`

Both should use Yarn 4, typecheck, best-effort lint, build, and publish Docker images on configured refs.

Relevant package scripts:

- `yarn build`: Next.js build plus `opennextjs-cloudflare build --skipNextBuild`.
- `yarn build:next`: Next.js build only.
- `yarn build:showcase`: showcase Next.js build only.
- `yarn preview`: OpenNext Cloudflare preview.
- `yarn deploy`, `yarn deploy:full`, `yarn deploy:only`: Cloudflare deployment helpers.
- `yarn cf-typegen`: Wrangler environment type generation.

Docker Hub inputs:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- optional `DOCKERHUB_REPO`, default `deanopen/barber-ai`

## Verification

Use these checks for normal changes:

```bash
yarn typecheck
yarn build:next
yarn build
git diff --check
```

Use `yarn dev:showcase` or `yarn build:showcase` when touching public showcase behavior.

`yarn build:next` verifies the app without the OpenNext step. `yarn build` verifies the full current build script. `yarn lint` is best-effort while it still points at `next lint`.

## Documentation Contract

- `README.md`: operator setup, contributor workflow, and common how-to steps.
- `PROJECT_OVERVIEW.md`: architecture, data, API, security, and maintenance map.
- `CLAUDE.md`: short future-agent memory and editing rules.

Update all three when a change crosses product mode, API, deployment, settings, generation, data retention, privacy, or major UI behavior.
