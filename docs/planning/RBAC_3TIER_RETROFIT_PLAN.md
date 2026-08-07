# CueLane — RBAC 3-Tier Retrofit Plan (Scenario 42) — dev-first, HARD HOLD

> Owner-APPROVED (2026-07-19d). Branch `feat/tenant-rbac-3tier` off `main`. LOCAL commits + DEV-DB only.
> No push/staging/prod/demo without a separate explicit owner word. Architect-verified 2026-08-07.

## Crux (prior handoff was WRONG)
- DB enum `UserRole { employee, admin }` — **no `super_admin` in the DB.** `user.role UserRole @default(employee)`.
- TS `Role { Employee='employee', Admin='admin', SuperAdmin='super_admin' }` — `SuperAdmin` is TS-only.
- Platform super-admin = **virtual identity** from Auth.js `super-admin-credentials` provider (env `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD_HASH`), `tenantId=null`, **no user row**. Tenant users map DB role → TS via `roleMap={admin:Admin, employee:Employee}` (`config.ts:80`). Roles ride JWT (`config.edge.ts`).

## Target role model
```ts
// packages/shared/src/types/index.ts
export enum Role {
  Employee = 'employee',
  TenantAdmin = 'tenant_admin',
  TenantSuperadmin = 'tenant_superadmin',
  TenantManager = 'tenant_manager',
}
```
| Current | Target | How |
|---|---|---|
| DB `admin` | `tenant_admin` | `ALTER TYPE … RENAME VALUE` |
| DB `employee` | `employee` | no-op (domain role) |
| — | `tenant_superadmin` | `ADD VALUE` + normalize one owner/tenant |
| — | `tenant_manager` | `ADD VALUE`; platform identity (D-RBAC-1) |
| TS `Role.SuperAdmin` | `Role.TenantManager` | rename symbol + all platform enforcement |

## Migrations — TWO separate (Postgres enum add-then-use hazard). Author via `prisma migrate dev --create-only` then hand-edit (Prisma refuses non-append enum changes — context7-verified).
**M1 `feat_rbac_enum_extend`:**
```sql
ALTER TYPE "UserRole" RENAME VALUE 'admin' TO 'tenant_admin';
ALTER TYPE "UserRole" ADD VALUE 'tenant_superadmin';
ALTER TYPE "UserRole" ADD VALUE 'tenant_manager';
```
**M2 `feat_rbac_owner_normalize`** (separate txn so the new enum value is committed before use):
```sql
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY "createdAt" ASC) AS rn
  FROM users WHERE role = 'tenant_admin' AND tenant_id IS NOT NULL
)
UPDATE users SET role = 'tenant_superadmin' WHERE id IN (SELECT id FROM ranked WHERE rn = 1);

CREATE UNIQUE INDEX "one_tenant_superadmin_per_tenant"
  ON users (tenant_id) WHERE role = 'tenant_superadmin' AND tenant_id IS NOT NULL;
```
`schema.prisma` `UserRole` edited to the 4-member target; partial index documented as a comment (Prisma can't model the WHERE), created only via M2 raw SQL. NEVER DROP/CREATE the type.

## Task list (dependency-ordered, ≤500 lines each)
- **T1 (SERIAL, first)** — schema.prisma enum + M1/M2 migrations. Verify: `migrate reset --force` + `migrate dev` apply clean on DEV; `\d+ users` shows the partial index; no `DROP TYPE`/`CREATE TYPE UserRole` in migrations; 2nd-owner INSERT rejected. Loadout: secure-code-guardian, context7.
- **T2 (SERIAL, after T1)** — `shared/types/index.ts` Role enum + `shared/schemas/index.ts` (`tenantRoleSchema=z.enum([Employee,TenantAdmin,TenantSuperadmin])`, create/updateUserRole schemas). Verify: shared typecheck + smoke test green.
- **T3 (SERIAL, after T2)** — `auth/config.ts` roleMap {tenant_admin→TenantAdmin, tenant_superadmin→TenantSuperadmin, employee→Employee}; super-admin provider emits `[Role.TenantManager]` (D-RBAC-1). Verify: config.test green; roleMap covers every DB value.
- **T4a (∥, after T3)** — PLATFORM rename SuperAdmin→TenantManager: middleware.ts, auth/tenant-guard.ts, trpc.ts (superAdminProcedure + adminProcedure isSuperAdmin), middleware/tenant.ts, routers/tenant.ts, super-admin/layout.tsx, api/system-ads/upload/route.ts.
- **T4b (∥, after T3)** — TENANT-ADMIN widen (admit TenantSuperadmin||TenantAdmin): trpc.ts adminProcedure, admin/_lib/access.ts isAdminRole, admin/layout.tsx, station/page.tsx, api/tenants/[slug]/media/upload/route.ts.
- **T4c (∥, after T3)** — USER-MGMT narrow: add `userManagementProcedure`(TenantSuperadmin||TenantManager) in trpc.ts; user.ts create/update/delete/list swap; users/UserFormDialog.tsx + users-client.tsx role set. Loadout: +frontend-design (shadcn only).
- **T5 (SERIAL)** — Succession: new `platformUser.ts` (reassignOwner, tenant_manager-gated) + in-tenant `transferOwnership` (tenant_superadmin-only); demote-before-promote to respect index; L5 audit; tests.
- **T6** — seed.ts: one tenant_superadmin/tenant + rest tenant_admin; platform tenant_manager per D-RBAC-1; creds from vault, never hardcoded; idempotent.
- **T7** — test sweep (~20 *.test.ts referencing Role.Admin/SuperAdmin/'super_admin').
- **T8 (last)** — full gate **cache-OFF** (`TURBO_FORCE=true`); exercise REAL dev stack, BOTH tenants (demo+clinic); back-port PRODUCT.md Roles&Permissions + DECISIONS_LOG; global lesson if any. LOCAL commit → STOP.

## Phase 2 (next milestone) — Custom-role permission matrix (D-RBAC-3)
CustomRole + RolePermission(view/write/update/delete) + User.customRoleId; `hasPermission` deny-by-default (3 fixed tiers short-circuit true); wire tRPC `matrixProcedure` + route middleware + matrix-driven sidebar + role-builder UI (shadcn); ceiling ≤ tenant_admin, NEVER Billing/User-Mgmt; only tenant_superadmin(+manager) create/assign.

## Risks
- Postgres "unsafe use of new enum value in same txn" → the two-migration split is MANDATORY.
- Prisma refuses enum rename in autogen SQL → `--create-only` + hand-edit always.
- Existing JWTs carry stale roles until re-login → force re-login in DEV to verify; note in DECISIONS_LOG.
- Contract change ripples to ~20 test files (compiler is the tripwire).
- Lesson honored: `db.tenant-rbac.enum-rename-and-partial-owner-index`.
