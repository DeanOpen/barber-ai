# syntax=docker/dockerfile:1.7

# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
# Yarn is pinned by packageManager and downloaded by Corepack; this repo does
# not commit a zero-install .yarn directory.
RUN --mount=type=cache,target=/root/.yarn \
    yarn install --immutable

# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# PUBLIC_SHOWCASE flips the build into a fully client-side, BYOK demo:
#   docker build --build-arg NEXT_PUBLIC_SHOWCASE=1 -t barber-ai:showcase .
# Leave unset for the normal shop kiosk image.
ARG NEXT_PUBLIC_SHOWCASE=
ENV NEXT_PUBLIC_SHOWCASE=${NEXT_PUBLIC_SHOWCASE}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && yarn build:next

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Re-export so server route handlers can read it; client bundles already have
# the value inlined at build time.
ARG NEXT_PUBLIC_SHOWCASE=
ENV NEXT_PUBLIC_SHOWCASE=${NEXT_PUBLIC_SHOWCASE}

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs \
 && mkdir -p /app/data \
 && chown -R nextjs:nodejs /app

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

VOLUME ["/app/data"]
USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/status >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
