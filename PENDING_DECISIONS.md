# CueLane — Pending Owner Decisions (`[WHAT]` / product / scope)

Non-blocking. The full-auto loop keeps advancing un-gated work; these re-surface each session until answered.
When answered, back-port to `docs/PRODUCT.md` + `docs/DECISIONS_LOG.md` before acting.

## Open

- [x] **D-RBAC-1 — Platform admin identity model (raised 2026-08-07; RESOLVED 2026-08-12 → promote to DB user).**
  **Owner decided: promote `tenant_manager` to a vault-backed DB user.** The platform account
  (`tenantadmin@powerbyteitsolutions.com`, from `Server-Setups/secrets/universal-login-credentials.enc.yaml`)
  is now a real DB row (`role=tenant_manager`, `tenant_id=NULL`) instead of the virtual env-credentials identity.
  Requires making `User.tenantId` nullable (the session/middleware layer already assumed `tenantId=null` for the
  platform tier; the one-owner partial-unique index already scopes `WHERE tenant_id IS NOT NULL`). Built on branch
  `feat/tenant-manager-db-user`, LOCAL / HARD HOLD. See `docs/DECISIONS_LOG.md` 2026-08-12 entry.

- [x] **D-RBAC-3 — Custom-role permission matrix scope (raised 2026-08-07; RESOLVED 2026-08-08 → BUILD).**
  Owner approved **Full Rule 34 Part B this cycle** (supersedes the gate). Matrix + role-builder are being built
  on `feat/rbac-view-access` (off `feat/tenant-rbac-3tier`), copy-source FerryBook, HARD HOLD local. Wave 0
  (schema + resolver + seed, commit 36a637d) done; Waves 1–3 (enforcement, builder UI, verify) pending. See
  `docs/DECISIONS_LOG.md` 2026-08-09 entry.
  - **Note (non-blocking):** D-RBAC-2 (owner-selection for a hypothetical multi-admin tenant) uses the safe
    deterministic default (earliest-`createdAt` admin → `tenant_superadmin`); seed tenants have exactly one admin, so
    it is not currently ambiguous.

- [x] **Free-tier Theme tab visibility (raised Wave 7.7b, 2026-07-09; RESOLVED 2026-08-12 → show tab, presets yes).**
  **Owner decided: show Free tenants the Theme tab (8 presets available), custom 9-color picker stays Premium-only.**
  This **confirms the already-shipped Wave 7.7b behavior** — no code change needed: `admin/_lib/access.ts:42`
  keeps `theme` OUT of `FREE_GATED_TAB_IDS`, and `access.test.ts:76` already asserts
  `isTabGatedForTier('theme', TenantTier.Free) === false`. Decision closed; existing behavior is the intended
  product behavior.

- [ ] **Public storage origin for staging/prod Display media (raised Wave 7.7d, 2026-07-09).**
  The Big Display plays locally-uploaded media via a presigned URL fetched **by the browser**, which needs a
  browser-reachable public storage origin (`MINIO_PUBLIC_ENDPOINT` / `STORAGE_PUBLIC_ENDPOINT`). Dev is wired
  (host-mapped MinIO :41709). **Staging/prod `.env.example` values are placeholders `CHANGE_ME_public_storage_origin`.**
  - **Question for owner (deploy-time, `[WHAT]`/infra-config):** what is the real public S3/R2/CDN origin for
    staging and prod object storage? (Also: the ~800MB premium upload cap needs a matching Traefik
    `client-body-size` at Phase-6 — only 60MB was load-tested in dev, which has no proxy.)
  - **Impact if unanswered:** **dev-only build is unaffected** (HARD HOLD = dev). Only blocks local-upload Display
    playback in staging/prod, which are owner-gated deploys anyway. Loop proceeds.
  - **Owner note (2026-08-12): DEFERRED to deploy-time.** Kept open intentionally — the real S3/R2/CDN origin is
    supplied when CueLane reaches its first staging/prod deploy. `.env.{staging,prod}.example` placeholders stay
    `CHANGE_ME_public_storage_origin` until then.

- [x] **Super Admin route path: `/super-admin` vs `/superadmin` (raised Wave 7.8, 2026-07-09; RESOLVED 2026-08-10 → `/superadmin`).**
  Owner decided: **match PRODUCT.md** (`/superadmin`, no hyphen). DONE this session — route directory
  `app/super-admin` → `app/superadmin`, middleware + login-form URL strings updated (internal provider id
  `super-admin-credentials` + mode literal left unchanged, non-routes). Commit `95e0063` on `feat/rbac-view-access`
  (LOCAL/HARD HOLD). Verified live: `/superadmin` → 200, old `/super-admin/dashboard` → 404; web build 24/24 green.
