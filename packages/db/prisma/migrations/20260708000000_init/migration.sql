-- CueLane initial schema migration
-- Creates all tables with indexes. Run BEFORE the RLS migration.

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "TenantTier" AS ENUM ('free', 'premium');
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended');
CREATE TYPE "VideoMode" AS ENUM ('playlist', 'live');
CREATE TYPE "UserRole" AS ENUM ('employee', 'admin');
CREATE TYPE "TicketStatus" AS ENUM ('waiting', 'serving', 'completed', 'skipped', 'noshow');
CREATE TYPE "PaymentStatus" AS ENUM ('active', 'past_due', 'cancelled', 'free');
CREATE TYPE "MediaType" AS ENUM ('youtube', 'local');
CREATE TYPE "AdType" AS ENUM ('youtube', 'uploaded');

-- ─── tenants (root identity — no tenant_id) ──────────────────────────────────

CREATE TABLE "tenants" (
    "id"           TEXT NOT NULL,
    "slug"         TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "tagline"      TEXT NOT NULL,
    "logo_url"     TEXT,
    "tier"         "TenantTier"   NOT NULL DEFAULT 'free',
    "status"       "TenantStatus" NOT NULL DEFAULT 'active',
    "settings"     JSONB NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- ─── services ────────────────────────────────────────────────────────────────

CREATE TABLE "services" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "icon"       TEXT NOT NULL,
    "color"      TEXT NOT NULL,
    "avg_time"   INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "services_tenant_id_idx" ON "services"("tenant_id");

-- ─── windows ─────────────────────────────────────────────────────────────────

CREATE TABLE "windows" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "windows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "windows_tenant_id_idx" ON "windows"("tenant_id");

-- ─── users ───────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "role"       "UserRole" NOT NULL DEFAULT 'employee',
    "pin"        TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- ─── user_services (User ↔ Service join table, tenantId for L6 guard) ────────

CREATE TABLE "user_services" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "service_id" TEXT NOT NULL,

    CONSTRAINT "user_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_services_user_id_service_id_key" ON "user_services"("user_id", "service_id");
CREATE INDEX "user_services_tenant_id_idx" ON "user_services"("tenant_id");

-- ─── tickets ─────────────────────────────────────────────────────────────────

CREATE TABLE "tickets" (
    "id"                     TEXT NOT NULL,
    "tenant_id"              TEXT NOT NULL,
    "service_id"             TEXT NOT NULL,
    "status"                 "TicketStatus" NOT NULL DEFAULT 'waiting',
    "window_id"              TEXT,
    "served_by"              TEXT,
    "priority"               BOOLEAN NOT NULL DEFAULT false,
    "transferred"            BOOLEAN NOT NULL DEFAULT false,
    "transferred_from"       TEXT,
    "return_to"              TEXT,
    "returned_from_transfer" BOOLEAN NOT NULL DEFAULT false,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "called_at"              TIMESTAMP(3),
    "completed_at"           TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tickets_tenant_id_idx" ON "tickets"("tenant_id");
CREATE INDEX "tickets_tenant_id_status_idx" ON "tickets"("tenant_id", "status");

-- ─── playlist_entries ────────────────────────────────────────────────────────

CREATE TABLE "playlist_entries" (
    "id"          TEXT NOT NULL,
    "tenant_id"   TEXT NOT NULL,
    "type"        "MediaType" NOT NULL,
    "title"       TEXT NOT NULL,
    "video_id"    TEXT,
    "storage_key" TEXT,
    "file_name"   TEXT NOT NULL,
    "file_size"   INTEGER NOT NULL,
    "file_ext"    TEXT NOT NULL,
    "is_live"     BOOLEAN NOT NULL DEFAULT false,
    "sort_order"  INTEGER NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "playlist_entries_tenant_id_idx" ON "playlist_entries"("tenant_id");

-- ─── system_ads (global — no tenant_id) ──────────────────────────────────────

CREATE TABLE "system_ads" (
    "id"          TEXT NOT NULL,
    "type"        "AdType" NOT NULL,
    "title"       TEXT NOT NULL,
    "video_id"    TEXT,
    "storage_key" TEXT,
    "file_name"   TEXT NOT NULL,
    "file_size"   INTEGER NOT NULL,
    "duration"    INTEGER NOT NULL,
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "sort_order"  INTEGER NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_ads_pkey" PRIMARY KEY ("id")
);

-- ─── tenant_ads ──────────────────────────────────────────────────────────────

CREATE TABLE "tenant_ads" (
    "id"          TEXT NOT NULL,
    "tenant_id"   TEXT NOT NULL,
    "type"        "AdType" NOT NULL,
    "title"       TEXT NOT NULL,
    "video_id"    TEXT,
    "storage_key" TEXT,
    "file_name"   TEXT NOT NULL,
    "file_size"   INTEGER NOT NULL,
    "duration"    INTEGER NOT NULL,
    "sort_order"  INTEGER NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_ads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tenant_ads_tenant_id_idx" ON "tenant_ads"("tenant_id");

-- ─── subscriptions ───────────────────────────────────────────────────────────

CREATE TABLE "subscriptions" (
    "id"                TEXT NOT NULL,
    "tenant_id"         TEXT NOT NULL,
    "tier"              "TenantTier"   NOT NULL DEFAULT 'free',
    "start_date"        TIMESTAMP(3)   NOT NULL,
    "end_date"          TIMESTAMP(3),
    "downgrade_at"      TIMESTAMP(3),
    "payment_status"    "PaymentStatus" NOT NULL DEFAULT 'free',
    "xendit_plan_id"    TEXT,
    "xendit_customer_id" TEXT,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- ─── password_reset_tokens ───────────────────────────────────────────────────

CREATE TABLE "password_reset_tokens" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at"    TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
CREATE INDEX "password_reset_tokens_tenant_id_idx" ON "password_reset_tokens"("tenant_id");

-- ─── audit_logs (L5 — always active, survives tenant deletion) ───────────────

CREATE TABLE "audit_logs" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT,
    "user_id"    TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "entity"     TEXT NOT NULL,
    "entity_id"  TEXT NOT NULL,
    "before"     JSONB,
    "after"      JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- ─── Foreign key constraints ─────────────────────────────────────────────────

ALTER TABLE "services"
    ADD CONSTRAINT "services_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "windows"
    ADD CONSTRAINT "windows_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
    ADD CONSTRAINT "users_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_services"
    ADD CONSTRAINT "user_services_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_services"
    ADD CONSTRAINT "user_services_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_services"
    ADD CONSTRAINT "user_services_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_window_id_fkey"
    FOREIGN KEY ("window_id") REFERENCES "windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_served_by_fkey"
    FOREIGN KEY ("served_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_transferred_from_fkey"
    FOREIGN KEY ("transferred_from") REFERENCES "windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_return_to_fkey"
    FOREIGN KEY ("return_to") REFERENCES "windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "playlist_entries"
    ADD CONSTRAINT "playlist_entries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_ads"
    ADD CONSTRAINT "tenant_ads_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
