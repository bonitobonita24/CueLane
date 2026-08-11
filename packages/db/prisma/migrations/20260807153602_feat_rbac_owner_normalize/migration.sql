WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY "created_at" ASC) AS rn
  FROM users WHERE role = 'tenant_admin' AND tenant_id IS NOT NULL
)
UPDATE users SET role = 'tenant_superadmin' WHERE id IN (SELECT id FROM ranked WHERE rn = 1);

CREATE UNIQUE INDEX "one_tenant_superadmin_per_tenant" ON users (tenant_id) WHERE role = 'tenant_superadmin' AND tenant_id IS NOT NULL;
