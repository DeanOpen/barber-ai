# Contributing to Barber Studio

Barber Studio is a private in-shop AI hairstyle preview station. It is not a booking platform, marketplace, or multi-tenant SaaS product. Keep changes operator-friendly, narrow, and aligned with the two supported runtime modes.

Demo (Public Showcase, no Admin): https://barber.deanopen.com

## Before You Start

- Read [`README.md`](./README.md) for the operator-facing overview, Quick Start, and API surface.
- Read [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) for the deeper technical and business architecture map.
- Read [`CLAUDE.md`](./CLAUDE.md) for the durable agent/contributor working context.

These three docs form a contract. If your change touches cross-cutting behavior (kiosk vs. showcase, generation, settings, retention, deployment, or API routes), update all three in the same patch.

## Development Setup

Prerequisites:

- Node.js 20+
- Corepack enabled for Yarn 4

```bash
corepack enable
yarn install
cp .env.local.example .env.local
yarn dev
```

Open `http://localhost:3000`. On first shop-mode run, the app creates `data/settings.json`. Sign in at `/admin` with `ADMIN_PASSWORD` (default `change-me`), then add the provider key and change the admin password.

To work on showcase mode locally:

```bash
yarn build:showcase
NEXT_PUBLIC_SHOWCASE=1 yarn start
```

## Runtime Modes — Keep Them Separate

| Mode | When | Generation | Storage |
| --- | --- | --- | --- |
| Shop kiosk (default) | Real shops | Server-side via `/api/generate*` using key in `data/settings.json` | `data/jobs/`, admin history |
| Public showcase | Demo / marketing | Browser-side via `lib/client-generate.ts` using a key in `localStorage` | None on server; `/admin` and `/api/generate*` return `410` |

Any feature that touches generation, settings, watermarking, or storage usually needs an explicit check for both paths. Do not leak shop-mode behavior into showcase, or assume server-side storage in showcase code.

## Editing Rules

- Preserve compact Ant Design admin styling. Admin is an operational tool, not a glossy landing page.
- Kiosk UI can be visual, but selection, capture, progress, retry, save, and present must stay clear.
- Keep copy practical and shop-facing.
- If prompt strategy changes, update both `lib/generate-runner.ts` and `lib/prompts.ts` (or document the intentional split).
- If data retention changes, update `README.md`, `PROJECT_OVERVIEW.md`, and `CLAUDE.md`.
- If API routes change, update the route tables in `README.md` and `PROJECT_OVERVIEW.md`.
- If deployment/env behavior changes, update `.env.local.example`, `docker-compose.yml`, `Dockerfile`, CI configs, `README.md`, and `PROJECT_OVERVIEW.md` together.
- Do not commit secrets, `data/`, `.env`, `.env.local`, `.next/`, or generated build output.

## High-Leverage Files

| Concern | File |
| --- | --- |
| Kiosk wizard, customer tabs, SSE resume, showcase flow | `app/page.tsx` |
| Admin login, settings, catalog editor, history | `app/admin/page.tsx` |
| Camera/upload capture and square normalization | `app/components/FaceCapture.tsx` |
| Public BYOK provider settings | `app/components/ShowcaseSetup.tsx` |
| Ant Design dark theme tokens | `app/theme.tsx` |
| Kiosk/admin visual classes and CSS variables | `app/globals.css` |
| Seed catalog, public defaults, category images, public types | `lib/defaults.ts` |
| Settings file creation, migration, public stripping | `lib/settings.ts` |
| Job lifecycle, persistence, SSE event bus | `lib/jobs.ts` |
| Admin history reads/delete | `lib/history.ts` |
| Server provider calls, prompts, image extraction, watermark | `lib/generate-runner.ts` |
| Showcase browser provider calls | `lib/client-generate.ts` |
| Browser-safe prompt builders | `lib/prompts.ts` |

## Adding Hairstyles

- Production path: use `/admin` -> Hairstyle prompts and save rows into `data/settings.json`.
- Seed catalog path: edit `PUBLIC_DEFAULTS.prompts` in `lib/defaults.ts`. Add local picker images under `public/style-references/<category>/` and point `imageUrl` at `/style-references/...`.

Good rows are concrete: length, shape, fade/taper, fringe, part, volume, texture, color, finish, and exclusions. Avoid vague style-only prompts.

## Generation Notes

- Individual mode creates one item per selected style.
- Grid mode creates one composite lookbook item, then allows limited full-detail renders.
- Server concurrency defaults to 3 and clamps between 1 and 6.
- Models with `/` in the id use the chat-completions image/modalities path.
- Other models use the images edit path.
- Watermark helpers should return the original image if watermarking fails.

## Privacy and Data Handling

Shop kiosk mode stores customer photos and generated previews under `data/jobs/`. Treat that folder as sensitive customer data. Public showcase mode must not read or write shop data — visitor keys and provider settings live only in browser `localStorage`.

Admin auth is one shared password (sha256-hashed cookie, invalidated on password change). Do not describe it as enterprise auth. If public exposure increases, propose rate limiting, stronger auth, consent/storage policy, and CSRF protection rather than expanding scope quietly.

## Verification

Run before handing off:

```bash
yarn typecheck
yarn build:next
yarn build
git diff --check
```

- `yarn build:next` checks the Next.js app without the OpenNext step.
- `yarn build` runs the current full build script (Next.js + `opennextjs-cloudflare build --skipNextBuild`).
- `yarn lint` is best-effort while the script still points at `next lint`.

## Pull Request Checklist

1. Branch is focused and small; no unrelated cleanup or speculative abstractions.
2. Both runtime modes still behave correctly (or the change is mode-scoped and documented).
3. Prompt edits are mirrored across `lib/generate-runner.ts` and `lib/prompts.ts` when relevant.
4. Cross-cutting changes update `README.md`, `PROJECT_OVERVIEW.md`, and `CLAUDE.md` together.
5. No secrets, `data/`, `.env*`, `.next/`, or build artifacts in the diff.
6. Verification commands above pass locally.
7. PR description names the modes touched (kiosk, showcase, or both) and lists doc files updated.

## Reporting Issues

When filing an issue, include:

- Mode (shop kiosk or public showcase) and how it was built.
- Browser, OS, and whether the camera or upload path was used.
- Provider, model id, and (if relevant) generation mode and count.
- Steps to reproduce, expected vs. actual, and any console/server logs with secrets redacted.

Never paste real provider keys, customer photos, or contents of `data/` into an issue or PR.
