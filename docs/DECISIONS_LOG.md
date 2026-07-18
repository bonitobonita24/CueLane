# Decisions Log — CueLane

Chronological record of locked architectural, product, and design decisions.
Append-only. Each entry documents what was decided, when, why, and whether it can be reversed.

---

## 2026-04-20 — Adopt HashiCorp visual aesthetic

**Decision:** Adopt HashiCorp visual aesthetic (color + typography + layout + theme) with shadcn/ui component implementation.

**Source:** https://getdesign.md/hashicorp/design-md (underlying: VoltAgent/awesome-design-md, `design-md/hashicorp/DESIGN.md`)

**Rationale:** HashiCorp's dual-mode aesthetic (clean white light-mode for informational surfaces + dramatic dark `#15181e`/`#0d0e12` for hero/product areas) directly mirrors CueLane's declared surface split in PRODUCT.md Design Identity — Big Display is dark-themed while Employee Station, Admin Panel, and Kiosk are light. The HashiCorp `--mds-color-*` token-driven component system maps cleanly onto CueLane's 9-token custom theme system (primary, primaryDark, primaryLight, primaryBorder, primaryGlow, gold, displayBg1/2/3). Tight heading line-heights (1.17–1.21) over relaxed body (1.50–1.69) and whisper-level shadows (0.05 opacity dual-layer) communicate enterprise-grade stability appropriate for B2B customers in banking, government, and healthcare sectors. Uppercase letter-spaced section labels (13px, weight 600, 1.3px tracking) provide systematic wayfinding for data-dense admin screens.

**Reversible:** YES — can be swapped by re-running prompt 4.8 with a different design (e.g. Linear, Vercel, Resend) from the VoltAgent/awesome-design-md collection.

**Affected files:**
- `docs/PRODUCT.md` — added Visual design reference line in Non-functional Requirements
- `docs/DESIGN.md` — created as authoritative visual reference (extracted sections 1, 2, 3, 5)
- `docs/DECISIONS_LOG.md` — this entry

**NOT affected (intentionally out of scope per prompt 4.8):**
- No changes to `inputs.yml`, `.env` files, code, or component implementations
- No changes to other PRODUCT.md sections
- Implementation of these tokens into `globals.css`, `layout.tsx`, and Tailwind config is handled separately during Phase 4 by Claude Code via scenarios.md Scenario 33

---

## Dev Environment Mode
Decision: MODE A — WSL2 native (the only supported mode as of V25)
Rationale: Devcontainer adds 4 virtualisation layers on WSL2 + Docker Desktop causing
permission errors, shell server crashes, and socket failures. WSL2 native eliminates all of this.
Docker Desktop provides the Docker socket to WSL2 natively. No DinD needed.
Locked: yes — do not re-ask or scaffold devcontainer files.

---

## 2026-05-03 — Port strategy (Rule 22)

**Decision:** All dev service ports derived from base port 41706 using fixed offsets.

| Service        | Port  | Offset |
|----------------|-------|--------|
| PostgreSQL     | 41706 | +0     |
| PgBouncer      | 41707 | +1     |
| Valkey/Redis   | 41708 | +2     |
| MinIO API      | 41709 | +3     |
| MinIO Console  | 41710 | +4     |
| MailHog SMTP   | 41711 | +5     |
| MailHog UI     | 41712 | +6     |
| pgAdmin        | 41713 | +7     |
| App (Next.js)  | 41716 | +10    |
| Worker         | 41717 | +11    |
| Prisma Studio  | 41726 | +20    |

Staging and production use standard ports (5432, 6379, 9000, etc.).
Locked: yes — do not change port assignments. All env files and inputs.yml already generated from this base.

---

## 2026-05-03 — Git branching strategy (Rule 23)

**Decision:** Branch-per-feature with squash-merge to main.

- Default branch: `main`
- Feature branches: `feat/{slug}`
- Phase 4 scaffold branches: `scaffold/part-{N}`
- Bug fix branches: `fix/{slug}`
- Commit style: conventional (feat:, fix:, chore:, docs:)
- Squash merge: true — keep main history clean
- Worktrees: enabled (`git.use_worktrees: true`) for Phase 4 Part isolation

Locked: yes — do not commit directly to main, do not reopen the branching strategy question.

---

## 2026-05-03 — Model routing

**Decision:** Three-model routing for different task types.

| Role       | Model                    | Used for                                        |
|------------|--------------------------|--------------------------------------------------|
| Planning   | claude-code              | Phase 2 interview, spec review                  |
| Execution  | claude-sonnet-4-6        | Phase 3–8 implementation via Claude Code (V31)  |
| Governance | gemini-2.5-flash-lite    | CHANGELOG_AI, agent-log, STATE.md — cheapest    |

Cline deprecated as of V31. Claude Code handles all phases.
Locked: yes — do not re-ask model routing. Stored in inputs.yml models section.

---

## 2026-05-03 — Docker image publishing

**Decision:** Publish Docker image to Docker Hub on every push to main.

- Registry: docker.io (Docker Hub)
- Hub repository: `bonitobonita24/cuelane`
- Image name: `cuelane`
- Platforms: linux/amd64, linux/arm64
- Build trigger: push to main branch only (Rule 23 squash-merge ensures clean main)
- Tags per push: `:latest`, `:staging-latest`, `:sha-{short-hash}`
- Staging deployment: Komodo `auto_update: true` — polls `:staging-latest`
- Production deployment: Komodo manual deploy from UI — uses `:latest`

GitHub Secrets required before first push:
- `DOCKERHUB_USERNAME` = bonitobonita24
- `DOCKERHUB_TOKEN` = Docker Hub access token (see CREDENTIALS.md)

Locked: yes — image name and hub_repo cannot be easily changed after deployment. Changing requires updating all server env files and redeploy.

---

## 2026-05-03 — Payment gateway: Xendit

**Decision:** Xendit is the payment gateway for all subscription billing.

- Gateway: Xendit (framework default for SEA markets)
- Region: Philippines (PH)
- Methods: cards, e-wallets, bank transfer, OTC, QR code
- Recurring: true — Xendit Plans API
- Refunds: partial and full
- Multi-currency: false — single currency PHP
- Webhook handling: receive → validate x-callback-token → enqueue to BullMQ → return 200 immediately

Dev uses TEST keys (no real charges). Staging/prod use LIVE keys.
API keys stored in CREDENTIALS.md (⏳ human must fill before Phase 5).
Locked: yes — switching gateways requires full payment module rewrite.

---

## 2026-05-03 — Spec stress-test (Phase 2.7)

**Decision:** `vibe_test.enabled: true` — spec stress-test active for this project.

Ran during Phase 2 confirmation. Confirms PRODUCT.md is implementation-ready before Phase 3.
Can be re-run: say "Re-run Phase 2.7" in Claude Code.

---

## 2026-05-03 — Tenancy: multi-tenant, subdirectory routing

**Decision:** Multi-tenant SaaS with `/{tenant}/` subdirectory URL prefix.

- Tenancy mode: multi
- Routing: subdirectory (not subdomain)
- Tenant field: `tenant_id` on every entity (NOT NULL in multi mode)
- Shared data: subscription_plans only (global plan definitions)
- All 6 security layers active (L1–L6): tRPC scoping, PostgreSQL RLS, RBAC, PgBouncer limits, AuditLog, Prisma guardrails
- Upgrade path: single_to_multi_ready (tenantId scaffolded even in single-tenant entities)

Locked: yes — changing routing from subdirectory to subdomain requires middleware rewrite, auth callback updates, and CORS changes.

---

## 2026-05-03 — Auth strategy

**Decision:** Dual auth providers for different user types.

| Provider          | Users              | Session type                                |
|-------------------|--------------------|----------------------------------------------|
| email_password    | Tenant Admins, Super Admin | JWT with userId, tenantId, roles      |
| pin_credentials   | Employees          | Stateless PIN — verified per-request, no cookie |

- Session strategy: JWT
- JWT fields: userId, tenantId, roles
- Employee session: `stateless_pin` — PIN code verified per-request, no persistent session cookie
- MFA: false
- Email verification: required for admin registration
- Password reset: email link, 1-hour expiry

Locked: yes — changing employee auth from stateless PIN to session-based requires significant client-side and middleware changes.

---

## 2026-05-03 — Cloudflare Turnstile bot protection

**Decision:** Turnstile enabled in Managed mode on public-facing auth pages only.

Protected pages:
- `/login`
- `/register`
- `/forgot-password`

Explicitly excluded (no Turnstile — these are customer/display surfaces):
- `/{tenant}/kiosk` — Customer Kiosk
- `/{tenant}/display` — Big Display

Widget mode: managed (Cloudflare decides whether to show checkbox)
Hostname strategy: prod domain only on real widget — dev + staging use Cloudflare official test keys
Widget count: 1

Dev/staging: test keys pre-filled (`1x00000000000000000000AA`)
Production: real keys required — ⏳ human fills in CREDENTIALS.md before Phase 5

Locked: yes — do not add Turnstile to kiosk or display pages. Those are public customer-facing, bot protection would degrade UX.

---

## 2026-05-17 — Email provider: SMTP (was Resend)

**Decision:** Replace Resend with generic SMTP relay for all transactional email. Same SMTP account used for staging and production.

**What changed:**
- `inputs.yml` `tech_stack.email`: `resend` → `smtp`
- `inputs.yml` `email.provider`: `resend` → `smtp`
- `inputs.yml` `email.relay_type`: new field — `generic` (host + credentials supplied by human)
- `inputs.yml` `email.same_account_for_staging_prod`: `true`
- `.env.dev`: removed `RESEND_API_KEY` (dev uses MailHog — `SMTP_HOST=localhost:41711` unchanged)
- `.env.staging`, `.env.prod`: removed `RESEND_API_KEY` (`SMTP_HOST/PORT/USER/PASSWORD/FROM/FROM_NAME` already present, all ⏳ until human fills)
- `.env.example`: removed Resend placeholder block
- `CREDENTIALS.md`: `## 📧 Resend API Key` section replaced with `## 📧 SMTP` section (handled via local script `upgrade-credentials-smtp.sh` per Scenario 34 — agent never reads CREDENTIALS.md content)

**Rationale:**
- User preference for standard SMTP over provider-specific API
- "Generic / Custom relay" selected from SMTP provider options — Bonito supplies SMTP host + credentials manually (no Gmail / SendGrid / AWS SES lock-in)
- Same SMTP account for staging + prod chosen for operational simplicity (single set of credentials to manage)
- Dev continues using MailHog (Docker-local catch-all) — unchanged

**Reversible:** YES — re-running this swap in the other direction requires reversing the same files. Email content templates do not exist yet (Phase 4 hasn't started), so no application-layer rewrite needed.

**Affected runtime:**
- BullMQ `email` queue worker (Phase 4 Part 4) will use `nodemailer` (or equivalent) wired to `SMTP_*` env vars
- No Resend SDK dependency to add to `package.json` later
- Webhook from email provider (delivery receipts) is now N/A — generic SMTP has no callback API

**Locked:** yes — do not re-introduce Resend without explicit decision change. If a future need for provider-specific features (event webhooks, suppression lists) emerges, revisit via Phase 7 Feature Update.

---

## 2026-07-08 — Realtime transport: SSE (not raw WebSocket) for Phase 7 queue sync

**Decision:** Implement the per-tenant realtime queue sync (Wave 7.2) with **Server-Sent Events** (Valkey pub/sub → Next.js Route Handler `ReadableStream`, browser `EventSource`), NOT a raw WebSocket server.

**Decided by:** PM (technical `[HOW]` call — not deferred to owner).

**Rationale:** PRODUCT.md §Realtime says "WebSocket," but the functional requirement is purely server→client fanout: per-tenant channel `tenant:{tenantId}:queue`, six events (ticket.called/completed/skipped/noshow/transferred/recalled), auto-reconnect, no polling. The surfaces (Big Display, Kiosk, Employee Station, Mobile) only *receive* — publishing happens through tRPC mutations, not the socket. `apps/web` runs `next start` (standalone, no custom server), so a WebSocket server would require ejecting to a custom server or a sidecar. SSE meets every functional need with native `EventSource` auto-reconnect and zero server ejection. "WebSocket" in PRODUCT.md is read as the *capability* (live push), not a hard transport mandate.

**Reversible:** yes — if a future feature needs client→server socket messaging (bidirectional), revisit with a WS sidecar or custom server. No such requirement exists in v1.

**Scope note:** does not affect Wave 7.1 (queue-engine backbone has no transport). Applies when Wave 7.2 (Realtime Transport) is built.

---

## 2026-07-08 — Wave 7.6 Admin Core CRUD: 6 locked PM decisions

**Decided by:** PM (technical `[HOW]` calls, pre-agreed before build).

1. **Limit semantics = block AT the cap.** A tenant-scoped create throws a typed `FORBIDDEN`
   when `existingCount >= limit` (not `>`). Free tenant may hold exactly 10 users / 6 services /
   4 windows — the 11th/7th/5th create is rejected. Premium tenants (`Tenant.tier === 'premium'`,
   e.g. the `demo` tenant) are unlimited: `limit = null` never blocks.
2. **`settings.theme` = a preset id string**, one of 8 (`indigo`, `ocean`, `emerald`, `rose`,
   `amber`, `violet`, `teal`, `slate`) — not an object. The custom 9-color-picker (`{ preset,
   custom: {...} }` shape) is DEFERRED to Wave 7.7. `packages/db/prisma/seed.ts`'s
   `settings.theme` is fixed from `{ preset: 'indigo' }` to the string `'indigo'`.
3. `printerConfigSchema` (packages/shared) gains `enabled: z.boolean().optional()` — the seed
   already writes `printerConfig.enabled: true`, the schema was missing the field.
4. `SERVICE_ICON_OPTIONS` (16 emoji) and `SERVICE_COLOR_OPTIONS` (12 hex, superset including
   every color the seed uses) are PM-authored constants in `packages/shared`. `createServiceSchema`
   is tightened to validate `icon`/`color` against these allowlists (was free-form regex/emoji).
5. **Tier source of truth for limit checks = `Tenant.tier`**, not `Subscription.tier` (the two can
   drift; `Tenant.tier` is what `queue.ts`'s existing Return-After-Done premium gate already reads).
6. Theme tab UI gating on Free tier is a Wave 7.6 UI-only follow-up — no backend action needed
   here beyond exposing `tier` via `tenantAdmin.getUsage`/`getSettings`.

**Multi-tenancy hard requirement (owner add-on, mid-wave):** every router/domain function in this
wave resolves `tenantId` from request context only (session — never a client-supplied tenant id,
never a hardcoded slug/id); every read/write is tenant-scoped via `withTenantContext` (async
callback form) + `findFirst({ id, tenantId })` guards before update/delete; limits/tier read from
that request's own `Tenant.tier`. T8's integration suite proves this against 2+ freshly-created
ephemeral tenants (no shared/seeded tenant assumption) plus isolation + independent-limit assertions.

**Reversible:** yes — decisions 1-6 are additive constants/validation; no destructive schema change.

---

## 2026-07-09 — Wave 7.7b Theme Runtime Wiring: 3 locked PM decisions

**Decided by:** PM (technical `[HOW]` calls, per the Wave 7.7b task brief).

1. **`settings.theme` widens to `ThemePresetId | { custom: CustomTheme }`.** The 8 presets
   (`packages/shared` `THEME_PRESETS`) now carry real WCAG-AA-checked HSL color values
   (`primary`/`primaryForeground`/`ring`), not just id/label. `CustomTheme` is a 9-key object
   (`primary`, `primaryForeground`, `secondary`, `secondaryForeground`, `accent`,
   `accentForeground`, `background`, `foreground`, `ring` — the vars Kiosk/Station/Admin actually
   consume, grepped across `apps/web` + `packages/ui`). Back-compat: every pre-existing bare
   `theme: 'indigo'`-shaped row still validates and resolves — `themeSettingSchema` is a union, and
   `resolveThemeVars()` is defensive against any legacy/malformed shape (including the
   pre-decision-2 `{ preset: 'indigo' }` object), always falling back to the default preset rather
   than throwing.
2. **Theme resolution happens server-side, once, in `[tenant]/layout.tsx`** — not a client
   effect — so there is no theme flash on first paint. This is the ONLY place `resolveThemeVars` is
   called for the live app surfaces; it reads `Tenant.settings` via the plain `prisma` client with
   no `withTenantContext` wrap (safe because `Tenant` is a GLOBAL_MODEL, same convention as
   `kiosk/page.tsx`/`display/page.tsx`).
3. **The Theme admin tab is UN-GATED for Free tier** (supersedes the 2026-07-08 Wave 7.6 call
   "Theme tab is Premium-only") — Free tenants now get the 8 presets; only the in-tab **custom**
   9-color picker stays Premium-gated (`ThemeClient` reads `Tenant.tier` directly, not a route-level
   gate). `FREE_GATED_TAB_IDS` (`admin/_lib/access.ts`) no longer contains `'theme'`.

**Note — Display screen is NOT yet wired to the theme vars.** `display-client.tsx` hardcodes its
entire palette (`#15181e`, `#FCD34D` gold, etc.) inline — it consumes zero CSS custom properties
today, so per-tenant theming has no visible effect there yet (Kiosk/Station/Admin DO pick it up via
`bg-primary`/`border-primary`/`text-primary-foreground`/`ring-ring` Tailwind classes). Rewiring the
Big Display to the theme system is OUT OF SCOPE for this wave — flagged as a follow-up, not fixed
here (deferred-fix-at-task-boundary discipline).

**Reversible:** yes — additive schema widening (union, not a breaking change) + a UI-gating
reversal (trivial to re-add `'theme'` to `FREE_GATED_TAB_IDS` if the owner wants the old gate back).

---

## 2026-07-09 — Wave 7.7c-T1: Media upload tier-cap byte conversion

**Decision:** `MAX_UPLOAD_BYTES_BY_TIER` (packages/storage/src/types.ts) = `{ free: 300 * 1024 * 1024, premium: 800 * 1024 * 1024 }` — i.e. binary MB (MiB), not decimal MB.

**Rationale:** `docs/PRODUCT.md` §"Media limits by tier" states "Free = 300MB per file. Premium = 800MB per file." but does not specify binary vs. decimal MB. Followed the same convention already used by the pre-existing `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024` (10MiB) constant in the same file, for internal consistency.

**Affected files:** `packages/storage/src/types.ts` (`MAX_UPLOAD_BYTES_BY_TIER`, `getMaxUploadBytesForTier`), `packages/storage/src/storage.ts` (`validateUpload` now honors an optional per-call `maxBytes` override).

**Reversible:** yes — trivial constant change, no schema/migration impact.

**Also noted (not fixed, out of scope for T1):** the dev MinIO stack (`deploy/compose/dev/docker-compose.infra.yml`) has no bucket auto-creation step (no `mc mb` init sidecar) — a fresh `docker volume` has zero buckets, so ANY upload (avatars, logos, media) fails with `NoSuchBucket` until one is created manually. Worked around for this session by creating the `cuelane-dev` bucket directly against the running MinIO container; flagging as a pre-existing infra gap for a future wave/follow-up, not part of the Media Manager scope.

---

## 2026-07-09 — Wave 7.7c-T3: Media upload route — buffering + body-size limit not fully verified

**Decision:** `apps/web/src/app/api/tenants/[slug]/media/upload/route.ts` reads the whole multipart
upload into memory (`await file.arrayBuffer()` → `Buffer.from(...)`) rather than streaming it
directly into an S3 multipart upload.

**Rationale:** Simplicity for this wave — Next.js Route Handlers expose the Fetch API
`Request.formData()`, which already buffers the body; a true streaming parser (busboy/formidable
piping straight into `@aws-sdk/client-s3`'s multipart upload API) is more complex and was not
required to prove the feature end-to-end.

**Known gap — NOT verified in this session:** PRODUCT.md's 300MB(free)/800MB(premium) per-file
caps were implemented and unit/integration-tested with small synthetic payloads only. Two
real-world constraints were NOT exercised with an actual multi-hundred-MB file:
1. Next.js Route Handler / reverse-proxy (Traefik in staging/prod) body-size limits — an
   experimental `proxyClientMaxBodySize` config option exists in newer Next.js canaries but its
   applicability to this app's pinned `next@15.1.x` / self-hosted (`output: 'standalone'`, Docker,
   not Vercel) deployment was not confirmed.
2. In-memory buffering of an 800MB file per concurrent upload request — a real memory-pressure
   risk under concurrent uploads that was not load-tested.

**Follow-up (not fixed here, flagged for a future wave):** verify an actual ~300-800MB upload
against the dev stack, and if Next.js/Traefik reject or truncate it, either raise the relevant
config limit or replace the buffering approach with a true streaming multipart upload.

**Reversible:** yes — an implementation detail, no schema/API contract change if swapped for
streaming later (the Route Handler's request/response shape stays the same).

---

## 2026-07-09 — Wave 7.7d-T1: public-origin signed URLs for Big Display media

**Decision:** `getSignedDownloadUrl`/new `getSignedGlobalUrl` in `@cuelane/storage` now presign
against a SECOND S3 client (`getPublicS3Client()`), configured with a new `MINIO_PUBLIC_ENDPOINT`
env var, instead of the existing internal `getS3Client()`.

**Rationale:** `MINIO_ENDPOINT` is the container-network hostname (`http://minio:9000` in every
compose stack — dev's `docker-compose.app.yml` `x-cuelane-runtime-env` anchor, and staging/prod's
`.env.staging`/`.env.prod`). Every existing storage consumer (Media upload route, admin CRUD) is
server-to-server, so that hostname is fine. The Big Display video panel is the FIRST caller that
hands a signed URL to a public, unauthenticated BROWSER (`<video src>` / local-media playback) —
a browser can never resolve `minio:9000`, so presigning against the internal client would produce
a URL that 100% fails to load. Presigned URLs are endpoint-bound (the signature covers the host),
so this requires a distinct client/endpoint, not just a string substitution after signing.

**New env var `MINIO_PUBLIC_ENDPOINT`** (optional — falls back to `MINIO_ENDPOINT` with a
console warning if unset): dev wired to `http://localhost:${STORAGE_PORT:-41709}` in
`deploy/compose/dev/docker-compose.app.yml`'s runtime-env anchor (the host-mapped MinIO port a
browser on the dev machine can reach). `.env.staging.example`/`.env.prod.example` +
the local `.env.staging`/`.env.prod` files gained a matching `STORAGE_PUBLIC_ENDPOINT` — **staging/
prod values are placeholders (`CHANGE_ME_public_storage_origin` in the `.example` files)** and
MUST be set to the real public S3/R2/CDN origin before the Big Display's local-upload playback
will work in those environments. Until then, local (uploaded-file) playlist entries will render a
broken video element on staging/prod Displays — YouTube playlist/live entries are unaffected (no
signed URL involved).

**Known pre-existing gap flagged, NOT fixed here (out of Wave 7.7d scope):**
`.env.staging`/`.env.prod` (and their `.example` counterparts) define ONLY `STORAGE_*`-prefixed
keys, never `MINIO_*` — but `apps/web/src/env.ts`'s zod schema requires `MINIO_ENDPOINT` etc, and
`@cuelane/storage`'s `config.ts` reads `MINIO_*` directly from `process.env`. Dev's compose file
bridges this with an explicit `x-cuelane-runtime-env` anchor (`MINIO_ENDPOINT: "http://minio:9000"`
etc, overriding the `STORAGE_*`-named `.env.dev`); **staging/prod's compose files have no such
bridge** (`env_file: .env.staging`/`.env.prod` passes `STORAGE_*` keys straight through, and there
is no `MINIO_*` translation anywhere in those two stacks). This predates Wave 7.7d and affects the
WHOLE storage layer (uploads, avatars, everything `@cuelane/storage` touches), not just Display
media — flagging for a future infra wave to add the same runtime-env bridge dev has, or rename
`config.ts`/`env.ts` to read `STORAGE_*` consistently everywhere.

**Reversible:** yes — additive env var + a second S3Client; no schema/API contract change.

---

## 2026-07-09 — Wave 7.7d-T2: YouTube embed via standard IFrame API (no unverified `host` param)

**Decision:** the Big Display video panel's `useYouTubePlayer` hook embeds YouTube playlist/ad/
live entries via the STANDARD `https://www.youtube.com/iframe_api` bootstrap + `new YT.Player(id,
{videoId, playerVars, events})` path, not the youtube-nocookie.com privacy-enhanced domain.

**Rationale:** context7 (`/websites/developers_google_youtube`, "iframe_api_reference" +
"player_parameters") was queried for a documented way to point the IFrame Player API at
`youtube-nocookie.com` (a commonly-repeated `host: 'https://www.youtube-nocookie.com'`
constructor option exists in community blog posts) — the OFFICIAL docs returned by context7 do
NOT confirm this option for the JS constructor path (only the manually-authored `<iframe src=.../>`
embed pattern documents the domain swap, via a differently-shaped setup this hook doesn't use).
Per the context7/"don't guess the API" discipline, an unverified option was not used. The CSP
(`next.config.ts`) still allow-lists `https://www.youtube-nocookie.com` in `frame-src` as a
no-cost defensive placeholder for a future switch if a verified path is found; today's actual
embeds go through `https://www.youtube.com`, which the same `frame-src`/`script-src` entries
permit.

**Reversible:** yes — swapping the bootstrap/embed domain later is a same-shaped change inside
`use-youtube-player.ts` only.

---

## 2026-07-09 — Wave 7.7d-T2: `--display-accent` (theme-primary lightened for dark background)

**Decision:** the Big Display replaces its hardcoded `#FCD34D` gold accent (window-name labels,
priority badge, up-next border/dot, waiting-bar label) with a new CSS var `--display-accent` —
NOT a direct `hsl(var(--primary))` substitution.

**Rationale:** `--primary`/`THEME_PRESETS` (packages/shared) are contrast-checked against a LIGHT
background + white foreground (Kiosk/Station/Admin — Wave 7.7b), not the Display's near-black
background. Several presets are dark hues at low lightness (e.g. 'slate' 27%, 'ocean' 32%) that
would nearly disappear as small accent text on `rgba(0,0,0,0.3)`. `--display-accent` is defined in
`packages/ui/src/styles/globals.css` as `color-mix(in hsl, hsl(var(--primary)) 60%, white 40%)` —
lightens ANY preset toward white by a fixed ratio, guaranteeing a legible-on-dark result without
per-preset hardcoding. A `@supports not (color: color-mix(...))` fallback restores the original
`#FCD34D`-equivalent (the 'amber-gold' preset's primary value) for any browser without color-mix
support. Ticket numbers, service names, and body text stay their existing white/light-gray —
`--display-accent` only replaces what was PREVIOUSLY hardcoded gold, nothing else.

**Not independently WCAG-contrast-verified per preset in this session** — color-mix's 60/40 ratio
is a reasonable heuristic (tested visually against the 'emerald' and 'slate' presets, both stayed
legible), not a computed-contrast-ratio guarantee for all 8 presets. Flagged as a fast-follow if a
future accessibility pass wants a per-preset computed check.

**Reversible:** yes — a single CSS custom property; reverting to hardcoded gold is a 1-line diff.

---

## 2026-07-09 — Wave 7.7d-T3: large-upload gap (Wave 7.7c-T3) — PARTIALLY VERIFIED

**Follow-up to the Wave 7.7c-T3 entry above.** `route.large.test.ts` now drives the REAL
`media/upload` Route Handler (Auth.js `auth()` mocked — the only piece with no HTTP session to
drive in a test process; storage/DB are 100% real, no mocks) with a genuine 60MB multipart body
containing a deterministic byte pattern (not zeros — rules out any accidental sparse-buffer
special-casing).

**Result: PASSES.** 60MB round-trips (multipart parse → in-memory buffer → real MinIO PUT →
`PlaylistEntry` row) in ~374–657ms, with byte-exact content verified via an independent
`getObject()` re-download (not just a "the DB row exists" check).

**On the specific ambiguity the prior entry raised** — an `experimental.proxyClientMaxBodySize`
Next.js Route Handler config option (default 10MB) that would reject an un-configured large body:
context7 (`/vercel/next.js/v15.1.8`) surfaces this option, but its own source attribution is the
`canary` branch, NOT the pinned `15.1.8` release this app runs — i.e. still not confirmed to exist
at this app's actual version. This test now gives an EMPIRICAL answer for that same version,
independent of the docs ambiguity: a 60MB body is NOT rejected by the framework in this app,
full stop.

**Still NOT verified (flagged, not fixed — genuinely out of a single test's reach):**
1. The full 800MB Premium cap specifically (this test uses 60MB — large enough to prove the code
   path is sound, not a full-cap load test, which would make the suite prohibitively slow).
2. Reverse-proxy (Traefik) body-size behavior in staging/prod — dev has no proxy in front of the
   app port, so this is untestable without a real staging deploy. Traefik has no default body-size
   cap (unlike nginx's `client_max_body_size`) unless explicitly configured, so the a priori risk
   is lower than originally flagged, but this is an assumption, not a verified fact.
3. Concurrent-upload memory pressure (multiple simultaneous large in-memory buffers) — still
   unverified; the streaming-multipart-upload alternative from the original Wave 7.7c-T3 entry
   remains a valid future improvement if this ever becomes a real production concern.

**Reversible:** n/a — test-only change, no production code touched by this entry.

---

## 2026-07-09 — Wave 7.8-T1: Tenant.tier as tier source-of-truth for Super Admin `setTier`

Super Admin's manual tier override (`superAdmin.setTier`) writes `Tenant.tier` — the field every
tenant-facing surface already reads (kioskProcedure's suspension check reads `Tenant.status`;
`displayRouter.media`, `tenantAdRouter`'s premium gate, and the Admin Panel's usage limits all read
`Tenant.tier`, never `Subscription.tier` — same convention `tenantAd.ts` already documented). If a
`Subscription` row exists for the tenant, `setTier` best-effort mirrors `tier` onto it (so a future
billing UI stays display-consistent), via `updateMany` (a no-op, 0 rows, if no Subscription row
exists yet — expected for a tenant that never went through the Xendit flow). The mirror write is
NEVER required for the toggle to succeed.

**Reversible:** yes — swapping which field is authoritative is a resolver-level change, no schema
migration involved.

---

## 2026-07-09 — Wave 7.8-T2: suspended-tenant UX is a plain FORBIDDEN error, no dedicated screen

A suspended tenant's Admin Panel / Employee Station calls now throw
`TRPCError({ code: 'FORBIDDEN', message: 'This branch is suspended.' })` from a new shared
`assertTenantActive()` helper (trpc.ts), called from `adminProcedure` and `staffProcedure`. This
wave does NOT build a dedicated "this branch is suspended" full-screen UI — the error surfaces via
whatever generic error/toast handling each page already has (same posture as any other TRPCError).
Chosen to keep the wave scoped to the CRUD platform surface; flagged in docs/STATE.md as a
fast-follow if the owner wants a friendlier suspended-tenant experience (e.g. a branded "Contact
your administrator" page instead of a raw error toast).

**Reversible:** yes — a dedicated error boundary/page can be layered on top without touching the
enforcement logic itself.

---

## 2026-07-09 — Wave 7.8-T3: System Ads route path `/super-admin` (not PRODUCT.md's `/superadmin`)

docs/PRODUCT.md line 38/107 specifies the Super Admin route as `/superadmin` (no hyphen). The
ACTUAL scaffolded route (Wave 7.7-era placeholder, already present in the codebase before this
wave, and named explicitly in this wave's task brief) is `/super-admin/dashboard`. This wave built
out the Super Admin surface on the EXISTING `/super-admin` path rather than migrating it to match
PRODUCT.md, since renaming would touch `middleware.ts`'s route matcher and any bookmarked/shared
links. Flagged for an owner call: either treat this as PRODUCT.md needing a correction (the code
predates this wave and is the de facto path), or explicitly request the rename.

**Reversible:** yes — a route rename (`app/super-admin/` → `app/superadmin/` + middleware.ts path
check) is mechanical, no data migration involved.

---

## 2026-07-09 — Wave 7.9-T1: signup/password-reset identifier is `{identifier, tenantSlug}`, not `email`

docs/PRODUCT.md's signup/password-reset flows (lines 14, 16) describe "email + password" and
"enters registered email." The User model has no `email` column (see `server/auth/config.ts`'s
pre-existing "TODO(schema-gap)" note — the real `admin-credentials` Auth.js provider already
authenticates by `User.name` scoped to `tenantSlug`, not email) — adding one requires a Prisma
migration, out of scope for this schema-frozen wave. `signupSchema.adminName` is the LOGIN
identifier (matches the existing provider exactly); `signupSchema.adminEmail` is a real contact
address stored in `Tenant.settings.adminEmail` (JSON, no migration needed) used ONLY to deliver the
password-reset email. `requestPasswordResetSchema` was redefined from `{email}` to
`{identifier, tenantSlug}` to match this reality. Password-reset request/confirm test/verify clean
against the real flow (see docs/STATE.md Wave 7.9-T4 evidence).

**Reversible:** yes — adding a real `User.email` column + backfilling from
`Tenant.settings.adminEmail` is a normal additive migration whenever the owner wants email-based
login; the current identifier-based login continues to work unchanged either way.

---

## 2026-07-09 — Wave 7.9-T1/T3: Turnstile + Xendit stub seams (owner-key-gated)

**Turnstile:** `server/lib/turnstile.ts`'s `verifyTurnstile()` no-ops (returns `true`) whenever
`TURNSTILE_SECRET_KEY` is unset OR is Cloudflare's official dummy always-pass key
(`1x0000...`, `.env.dev`'s current value) — this is intentional, not a bug: dev/test never renders
a real challenge, so the server-side check must not block signup/login there. The signup form only
mounts the Turnstile widget placeholder once `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is a real (non-dummy)
key. The real `https://challenges.cloudflare.com/turnstile/v0/siteverify` call IS implemented and
will fire automatically the moment the owner rolls a live key into `.env.staging`/`.env.prod` at
Phase-6 — no code change needed then, only the CREDENTIALS.md key rollout.

**Xendit:** untouched this wave. Every signup creates a Free-tier tenant only; the paid-upgrade
flow (Xendit-hosted payment linking, webhooks) remains Wave 7.8's existing, separate surface,
unaffected by Wave 7.9.

**Owner action needed (deferred, not blocking):** none until Phase-6 deploy prep — both seams work
correctly in dev/test today. When the owner is ready to go live, supply real
`TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` (and, separately, live Xendit keys per the existing
Wave 7.8 arrangement) via CREDENTIALS.md — no further code change is required for Turnstile.

**Reversible:** yes — purely a config/key change, no code path needs to be revisited.

---

## 2026-07-10 — Cross-tenant protected-page guard implemented in middleware (previously deferred slug-in-JWT)

**Decision:** The previously-deferred "slug-in-JWT" optimisation is now **implemented**, reversing
the earlier deferral note (`middleware.ts` step 5 formerly read: *"NOTE: slug-in-JWT optimisation
tracked in DECISIONS_LOG"* with only a session-exists check). The tenant **slug** is now carried in
the JWT at sign-in (the `admin-credentials` provider already resolves the tenant by slug; it now
returns `tenantSlug` on the user object → `jwt` callback → `session.user.tenantSlug`), so the Edge
middleware can compare the URL `{tenant}` slug against the session user's own tenant **without a DB
call**. For `PROTECTED_TENANT_PATHS` (`/station`, `/admin`): if the URL slug ≠ the session tenant
slug AND the user is not a Super Admin, middleware now **redirects to the same sub-path under the
user's OWN slug** (e.g. a `demo` admin visiting `/clinic/admin/users` → `/demo/admin/users`) instead
of rendering another tenant's page chrome populated with the visitor's own data. Super Admin is
exempt (may access any tenant); unauthenticated requests still redirect to `/login` as before.

**Why:** defense-in-depth aligned with attack-informed-hardening (BOLA / cross-tenant object-access
depth). **Data isolation already held** and is UNCHANGED — the tRPC `requireTenant` / L6 Prisma
guard / RLS layer remains the authoritative isolation boundary and scopes every read/write to the
session `tenantId`, ignoring the URL slug (so there was never a data leak). This closes the
page-render / UX + defense-in-depth gap only: it stops a valid session from ever rendering a
different tenant's slug in the chrome.

**Affected files:** `apps/web/src/server/auth/tenant-guard.ts` (new, edge-safe pure decision fn +
`tenant-guard.test.ts`), `apps/web/src/server/auth/config.ts` (authorize returns carry `tenantSlug`),
`apps/web/src/server/auth/config.edge.ts` (jwt + session callbacks propagate `tenantSlug`),
`apps/web/src/types/next-auth.d.ts` (`tenantSlug` on Session.user / User / JWT), `apps/web/src/middleware.ts`.

**Reversible:** yes — remove the slug from the JWT return + revert middleware step 5 to the
session-exists check; the tRPC/L6/RLS DB-layer guard (kept intact) continues to enforce isolation
regardless.

---

## 2026-07-19 — Real-time transport is SSE (spec-divergent: transport) — accept, back-port PRODUCT.md

**Decision:** The real-time queue-sync transport is **SSE (Server-Sent Events)**, not WebSocket.
PRODUCT.md previously specified *"WebSocket connection per tenant via Valkey pub/sub"*; the built
system (Wave 7.2) ships SSE over that **same Valkey pub/sub backbone** with strict per-tenant channel
isolation. Owner decision (2026-07-19): **accept SSE and back-port the spec** — the 12 "WebSocket"
mentions in PRODUCT.md were reconciled to "SSE (Server-Sent Events) over Valkey pub/sub" this session.
Resolves `docs/PENDING_DECISIONS.md` D1.

**Tag:** `spec-divergent: transport` — the implementation drove the spec (LIVING-SPEC / Flow-Back,
Rule 1). The spec's substance (live per-tenant updates on call/complete/skip/transfer via Valkey
pub/sub) was always met; only the browser-facing transport word changed.

**Rationale:** Queue updates are unidirectional (server → client); clients trigger events via tRPC
mutations that publish to the tenant Valkey channel, never over the socket. SSE fits this exactly —
native `EventSource` auto-reconnect, no bidirectional/WS-upgrade overhead — and is already live and
tested across Kiosk, Big Display, and Employee Station. Implementing true WebSocket would be real work
with no functional gain for this use case.

**Affected files:** `docs/PRODUCT.md` (12 transport lines reconciled WebSocket → SSE). No code change
— the SSE implementation (`apps/web/src/app/api/tenants/[slug]/queue/stream/route.ts` +
`apps/web/src/server/realtime/publisher.ts`) was already the shipped behavior.

**Reversible:** yes (as a product decision) — if true WebSocket is later required, reopen D1 as a
Feature Update and swap the browser transport (keep the Valkey pub/sub backbone). The Valkey channel
layer is transport-agnostic.
