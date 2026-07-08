-- Wave 7.1 — Queue Engine Backbone schema addendum.
-- Adds: services.number (per-tenant ordinal), tickets.number/sequence (persisted display
-- number), sequence_counters (atomic per-tenant numbering source). Hand-written (not
-- `prisma migrate dev`) because the new NOT NULL columns need a deterministic backfill on
-- existing seed rows before the NOT NULL + UNIQUE constraints can be applied.

-- ─── sequence_counters ────────────────────────────────────────────────────────

CREATE TABLE "sequence_counters" (
    "id"        TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "value"     INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequence_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sequence_counters_tenant_id_key_key" ON "sequence_counters"("tenant_id", "key");

ALTER TABLE "sequence_counters" ADD CONSTRAINT "sequence_counters_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── services.number ──────────────────────────────────────────────────────────

ALTER TABLE "services" ADD COLUMN "number" INTEGER;

-- Backfill: per-tenant ordinal assigned by creation order (deterministic, matches seed order).
WITH ranked AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at" ASC, "id" ASC) AS rn
    FROM "services"
)
UPDATE "services" s SET "number" = ranked.rn
FROM ranked WHERE ranked."id" = s."id";

ALTER TABLE "services" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "services_tenant_id_number_key" ON "services"("tenant_id", "number");

-- ─── tickets.number / tickets.sequence ─────────────────────────────────────────

ALTER TABLE "tickets" ADD COLUMN "number" TEXT;
ALTER TABLE "tickets" ADD COLUMN "sequence" INTEGER;

-- Backfill: priority tickets get a tenant-wide "P-NNN" sequence; regular tickets get a
-- per-tenant-per-service "{service.number}-NNN" sequence. Both ordered by createdAt so the
-- backfilled numbers are stable and match issuance order.
WITH priority_ranked AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at" ASC, "id" ASC) AS rn
    FROM "tickets" WHERE "priority" = true
),
regular_ranked AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "tenant_id", "service_id" ORDER BY "created_at" ASC, "id" ASC) AS rn
    FROM "tickets" WHERE "priority" = false
)
UPDATE "tickets" t SET
    "sequence" = COALESCE(priority_ranked.rn, regular_ranked.rn),
    "number" = CASE
        WHEN priority_ranked.rn IS NOT NULL THEN 'P-' || LPAD(priority_ranked.rn::text, 3, '0')
        ELSE (SELECT s."number" FROM "services" s WHERE s."id" = t."service_id")::text
             || '-' || LPAD(regular_ranked.rn::text, 3, '0')
    END
FROM (SELECT * FROM priority_ranked) priority_ranked
FULL OUTER JOIN regular_ranked ON regular_ranked."id" = priority_ranked."id"
WHERE t."id" = COALESCE(priority_ranked."id", regular_ranked."id");

ALTER TABLE "tickets" ALTER COLUMN "number" SET NOT NULL;
ALTER TABLE "tickets" ALTER COLUMN "sequence" SET NOT NULL;

CREATE INDEX "tickets_tenant_id_created_at_idx" ON "tickets"("tenant_id", "created_at");
