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
