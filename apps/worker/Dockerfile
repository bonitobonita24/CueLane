# ─────────────────────────────────────────────────────────────────────────────
# CueLane — Worker production image
# Multi-stage build for the @cuelane/worker BullMQ background service.
# Context: monorepo root (docker build -f apps/worker/Dockerfile .)
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1 — install all dependencies (dev + prod, needed for tsc compilation)
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
# Copy workspace manifest + lockfile for deterministic install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Copy each workspace package.json so pnpm can resolve workspace protocol
COPY packages/db/package.json      ./packages/db/
COPY packages/jobs/package.json    ./packages/jobs/
COPY packages/shared/package.json  ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY apps/worker/package.json      ./apps/worker/
RUN pnpm install --frozen-lockfile

# Stage 2 — build workspace packages + worker
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
# Carry node_modules from deps stage.
# pnpm hoists all deps to the root node_modules; individual package dirs do NOT exist.
COPY --from=deps /app/node_modules ./node_modules
# Copy source — build stage can COPY . . safely (this is NOT the runtime stage)
COPY tsconfig.base.json turbo.json ./
COPY packages/db      ./packages/db
COPY packages/jobs    ./packages/jobs
COPY packages/shared  ./packages/shared
COPY packages/storage ./packages/storage
COPY apps/worker      ./apps/worker
# Generate Prisma client (must precede tsc so @prisma/client types are available)
RUN pnpm --filter @cuelane/db db:generate
# Build workspace deps in dependency order, then the worker
RUN pnpm --filter @cuelane/shared  build && \
    pnpm --filter @cuelane/jobs    build && \
    pnpm --filter @cuelane/storage build && \
    pnpm --filter @cuelane/db      build && \
    pnpm --filter @cuelane/worker  build
# Patch workspace package.json exports → point to compiled dist (not TS source)
# Required so plain `node` can resolve @cuelane/* at runtime without tsx
RUN node -e "var fs=require('fs');['packages/db','packages/jobs','packages/shared','packages/storage'].forEach(function(p){var f=p+'/package.json';var pkg=JSON.parse(fs.readFileSync(f,'utf8'));function fix(s){return typeof s==='string'?s.replace(/\/src\//g,'/dist/').replace(/\.ts$/g,'.js'):s;}if(pkg.exports){if(typeof pkg.exports==='string'){pkg.exports=fix(pkg.exports);}else{Object.keys(pkg.exports).forEach(function(k){if(typeof pkg.exports[k]==='string')pkg.exports[k]=fix(pkg.exports[k]);});}}if(pkg.main)pkg.main=fix(pkg.main);fs.writeFileSync(f,JSON.stringify(pkg,null,2)+'\n');process.stdout.write('Patched '+f+'\n');});"

# Stage 3 — minimal production runner (scoped copies — NEVER COPY . . in this stage)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker
# External dependencies — full node_modules (includes pnpm workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules
# Compiled workspace packages (with patched package.json exports pointing to dist/)
# pnpm symlinks in node_modules resolve to these package directories at runtime
COPY --from=builder /app/packages/db/dist          ./packages/db/dist
COPY --from=builder /app/packages/db/package.json  ./packages/db/
COPY --from=builder /app/packages/jobs/dist         ./packages/jobs/dist
COPY --from=builder /app/packages/jobs/package.json ./packages/jobs/
COPY --from=builder /app/packages/shared/dist          ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json  ./packages/shared/
COPY --from=builder /app/packages/storage/dist          ./packages/storage/dist
COPY --from=builder /app/packages/storage/package.json  ./packages/storage/
# Compiled worker entry point
COPY --from=builder /app/apps/worker/dist          ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json  ./apps/worker/
USER worker
CMD ["node", "apps/worker/dist/index.js"]
