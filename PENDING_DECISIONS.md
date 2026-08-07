# CueLane — Pending Owner Decisions (`[WHAT]` / product / scope)

Non-blocking. The full-auto loop keeps advancing un-gated work; these re-surface each session until answered.
When answered, back-port to `docs/PRODUCT.md` + `docs/DECISIONS_LOG.md` before acting.

## Open

- [ ] **D-RBAC-1 — Platform admin identity model (raised during RBAC 3-tier retrofit, 2026-08-07).**
  The retrofit keeps the platform `tenant_manager` as a **virtual env-credentials identity** (Auth.js
  `super-admin-credentials`, `tenantId=NULL`, no DB user row) for the backbone pass — lowest risk, no auth-flow
  rewrite. The fleet standard (`~/.claude/rules` universal-login vault) + Scenario 42 step 6 envision a **real DB
  `tenant_manager` row** seeded from `tenantadmin@powerbyteitsolutions.com`.
  - **Question for owner:** promote `tenant_manager` to a vault-backed DB user now, or keep it virtual until
    multi-platform-admin is actually needed? Rolling the vault cred into an already-built app is owner-gated (HARD HOLD).
  - **Impact if unanswered:** none — backbone proceeds with the virtual identity; DB value `tenant_manager` exists
    but is unused in the users table. Fully reversible later.

- [ ] **D-RBAC-3 — Custom-role permission matrix scope (raised 2026-08-07).**
  Scenario 42 stages the tenant-scoped custom-role matrix (CustomRole + RolePermission + role-builder UI) as a
  **separate gated pass** after the 3-tier backbone. Full Auto sequences it as the **next milestone** after the
  backbone ships. Confirm whether the matrix is wanted this cycle or deferred further.
  - **Note (non-blocking):** D-RBAC-2 (owner-selection for a hypothetical multi-admin tenant) uses the safe
    deterministic default (earliest-`createdAt` admin → `tenant_superadmin`); seed tenants have exactly one admin, so
    it is not currently ambiguous.

- [ ] **Free-tier Theme tab visibility (raised Wave 7.7b, 2026-07-09).**
  Wave 7.7b **un-gated the Theme tab for the Free tier** — Free tenants now see the Theme tab with the 8 presets
  available, but the **custom color picker disabled** behind upgrade copy (Premium-only). This **reverses the
  Wave 7.6-T7 decision**, which hid the *entire* Theme tab from Free tenants.
  - Followed this wave's explicit brief ("Free tier = presets only, custom disabled w/ upgrade copy"), which implies
    the tab is visible. Recorded in `docs/DECISIONS_LOG.md`.
  - **Question for owner:** Is showing Free tenants the Theme tab (presets yes, custom no) the intended product
    behavior, or should the whole tab stay hidden from Free (revert to 7.6-T7)?
  - **Impact if unanswered:** cosmetic/product-positioning only; no functional or security impact. Loop proceeds.

- [ ] **Public storage origin for staging/prod Display media (raised Wave 7.7d, 2026-07-09).**
  The Big Display plays locally-uploaded media via a presigned URL fetched **by the browser**, which needs a
  browser-reachable public storage origin (`MINIO_PUBLIC_ENDPOINT` / `STORAGE_PUBLIC_ENDPOINT`). Dev is wired
  (host-mapped MinIO :41709). **Staging/prod `.env.example` values are placeholders `CHANGE_ME_public_storage_origin`.**
  - **Question for owner (deploy-time, `[WHAT]`/infra-config):** what is the real public S3/R2/CDN origin for
    staging and prod object storage? (Also: the ~800MB premium upload cap needs a matching Traefik
    `client-body-size` at Phase-6 — only 60MB was load-tested in dev, which has no proxy.)
  - **Impact if unanswered:** **dev-only build is unaffected** (HARD HOLD = dev). Only blocks local-upload Display
    playback in staging/prod, which are owner-gated deploys anyway. Loop proceeds.

- [ ] **Super Admin route path: `/super-admin` vs `/superadmin` (raised Wave 7.8, 2026-07-09).**
  The Super Admin surface was built at **`/super-admin/*`** (matching the pre-existing scaffolded
  `super-admin/dashboard` page + the auth callback). **`docs/PRODUCT.md` writes it as `/superadmin`** (no hyphen).
  - **Question for owner (`[WHAT]`, trivial):** which spelling is canonical? Default technical reconciliation is to
    make the route match PRODUCT.md (source of truth) — a one-directory rename + auth-callback update — unless you
    prefer the hyphenated `/super-admin`, in which case PRODUCT.md gets the one-word edit.
  - **Impact if unanswered:** cosmetic URL only; the surface fully works at `/super-admin`. Loop proceeds.
