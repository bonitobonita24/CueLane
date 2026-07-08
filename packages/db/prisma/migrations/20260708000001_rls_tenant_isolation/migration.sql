-- CueLane RLS migration — tenancy=multi (ACTIVE, NOT commented)
-- Enables Row-Level Security on all tenant-scoped tables.
-- Policy filters rows using app.current_tenant_id set by withTenant() before each transaction.
-- The Prisma app user (not a superuser) is subject to these policies.
-- Super-admin DB operations use a separate connection with BYPASSRLS privilege.
--
-- Tables excluded from RLS:
--   tenants       — root identity table; access controlled at application layer
--   system_ads    — global, no tenant_id column
--   audit_logs    — tenantId nullable (platform-level ops); retain after tenant deletion

-- ─── services ────────────────────────────────────────────────────────────────

ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "services"
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ─── windows ─────────────────────────────────────────────────────────────────

ALTER TABLE "windows" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "windows"
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ─── users ───────────────────────────────────────────────────────────────────

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "users"
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ─── user_services ───────────────────────────────────────────────────────────

ALTER TABLE "user_services" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "user_services"
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ─── tickets ─────────────────────────────────────────────────────────────────

ALTER TABLE "tickets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "tickets"
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ─── playlist_entries ────────────────────────────────────────────────────────

ALTER TABLE "playlist_entries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "playlist_entries"
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ─── tenant_ads ──────────────────────────────────────────────────────────────

ALTER TABLE "tenant_ads" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "tenant_ads"
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ─── subscriptions ───────────────────────────────────────────────────────────

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "subscriptions"
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ─── password_reset_tokens ───────────────────────────────────────────────────

ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "password_reset_tokens"
    USING (tenant_id = current_setting('app.current_tenant_id', true));
