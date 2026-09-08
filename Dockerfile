# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the Vite client bundle and the esbuild server bundle.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Reinstall with dev dependencies pruned. esbuild bundles with
# `--packages=external`, so dist/server.cjs still needs node_modules at runtime.
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: runtime.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# Chromium for PDF export (puppeteer-core ships no browser of its own), plus the
# fonts a headless render needs -- without them the PDF falls back to a single
# system face and reflows differently from the on-screen resume.
# server.ts prefers /usr/bin/chromium (findLocalChromeOrEdgePath) and only falls
# back to the bundled @sparticuz/chromium when no system browser is present.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-dejavu-core \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

# Non-root. Chromium is launched with --no-sandbox (server.ts), which is what
# makes an unprivileged container user workable without CAP_SYS_ADMIN.
USER node

EXPOSE 8080

# dumb-init reaps the zombie processes headless Chromium leaves behind and
# forwards SIGTERM, so `docker stop` is clean rather than a 10s kill timeout.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.cjs"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
