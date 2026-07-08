# Stage 1 — install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
# Workspace-aware install: pnpm needs the workspace manifest + EVERY package's
# package.json to resolve workspace:* deps and their transitive deps (e.g.
# tailwindcss-animate declared in packages/ui). Copying only the root manifest
# yields an incomplete node_modules and a "Cannot find module" build failure.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json       ./apps/web/
COPY apps/worker/package.json    ./apps/worker/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/db/package.json    ./packages/db/
COPY packages/jobs/package.json  ./packages/jobs/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY packages/ui/package.json    ./packages/ui/
RUN pnpm install --frozen-lockfile

# Stage 2 — build
FROM node:22-alpine AS builder
WORKDIR /app
# pnpm is required to run the build script; each FROM starts a fresh image so it
# must be re-installed here (the deps stage's global pnpm does not carry over).
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=true
# Generate the Prisma client before the Next.js build — @cuelane/db's `build`
# script is `tsc` only, so the client is not otherwise produced in a clean image.
RUN pnpm --filter @cuelane/db db:generate
RUN pnpm build

# Stage 3 — minimal production runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma's query engine needs OpenSSL present to detect the libssl version; without
# it, Prisma defaults to openssl-1.1.x and looks for the wrong engine binary.
# libc6-compat covers glibc-linked native deps on musl.
RUN apk add --no-cache openssl libc6-compat
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Monorepo standalone layout: Next traces the whole workspace, so the standalone
# output lives at apps/web/.next/standalone/ with the entrypoint at apps/web/server.js
# and hoisted node_modules at the standalone root. Copy that whole tree, then overlay
# the static assets under apps/web/.next/static. There is no public/ dir in this app.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Prisma query engine: Next's standalone output bundles @prisma/client into the
# webpack server chunk but does NOT place the native engine (.so.node) on disk.
# Prisma's runtime loader searches .next/server among other paths — drop the
# musl/openssl-3 engine there so the query engine loads. Source path is pinned to
# the @prisma/client version in pnpm-lock.yaml; bump it if @prisma/client changes.
COPY --from=builder \
  /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node \
  ./apps/web/.next/server/
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
