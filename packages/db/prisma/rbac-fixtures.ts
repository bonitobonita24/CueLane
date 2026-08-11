/**
 * RBAC Wave 3 (Rule 34 Part B) — deterministic e2e verify fixtures.
 *
 * The `demo` tenant seed (seed.ts) on this branch ships only a tenant_superadmin
 * ("Branch Admin") + plain employees — it has NO tenant_admin and NO custom-role
 * employee, so the per-role view-access matrix can't be verified end to end from the
 * seed alone. This script adds exactly those two missing principals (plus the custom
 * role they hinge on) as ADDITIVE, IDEMPOTENT, QA-prefixed rows on `demo`, so
 * `e2e/rbac-view-access.spec.ts` can log in as each fixed tier AND an
 * employee-with-custom-role and assert the resolved admin-shell nav.
 *
 * Touches ONLY QA-prefixed rows — never the real seed data — and is safe to re-run
 * (part of the reproducible evidence check_command). seed.ts is left untouched (zero
 * merge friction with the feat/demo-quick-login branch). Lives beside seed.ts so the
 * @prisma/client + bcryptjs workspace deps resolve exactly as the seed's do.
 *
 * Run (from repo root): `pnpm --filter @cuelane/db exec dotenv -e ../../.env.dev -- tsx prisma/rbac-fixtures.ts`
 * or simply `set -a; source .env.dev; set +a; pnpm --filter @cuelane/db exec tsx prisma/rbac-fixtures.ts`
 */
import { PrismaClient, type FeatureKey } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Matches seed.ts hashPin (bcrypt, cost 10) so admin-credentials bcrypt.compare validates these PINs.
function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

// The 'contributor' preset expansion over the 7 WRITABLE features, mirroring
// apps/web/src/lib/rbac/presets.ts presetMatrix('contributor') EXACTLY:
//   dashboard → view only; services/windows/media → view+write; settings/theme/usage → none.
// (users/roles are OWNER_ONLY and never appear in a custom-role matrix.)
const CONTRIBUTOR_MATRIX: { featureKey: FeatureKey; view: boolean; write: boolean; update: boolean; delete: boolean }[] = [
  { featureKey: 'dashboard', view: true, write: false, update: false, delete: false },
  { featureKey: 'services', view: true, write: true, update: false, delete: false },
  { featureKey: 'windows', view: true, write: true, update: false, delete: false },
  { featureKey: 'media', view: true, write: true, update: false, delete: false },
  { featureKey: 'settings', view: false, write: false, update: false, delete: false },
  { featureKey: 'theme', view: false, write: false, update: false, delete: false },
  { featureKey: 'usage', view: false, write: false, update: false, delete: false },
];

const ROLE_NAME = 'QA Contributor';
const ADMIN_NAME = 'QA Branch Manager';
const EMP_NAME = 'QA Contributor Emp';

async function upsertUserByName(
  tenantId: string,
  name: string,
  role: 'tenant_admin' | 'employee',
  pin: string,
  customRoleId: string | null,
): Promise<string> {
  const existing = await prisma.user.findFirst({ where: { tenantId, name } });
  if (existing == null) {
    const created = await prisma.user.create({ data: { tenantId, name, role, pin: hashPin(pin), customRoleId } });
    return created.id;
  }
  await prisma.user.update({ where: { id: existing.id }, data: { role, pin: hashPin(pin), customRoleId } });
  return existing.id;
}

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (tenant == null) {
    throw new Error('RBAC fixtures: `demo` tenant not found — run the base seed first (pnpm db:seed).');
  }
  const tenantId = tenant.id;

  const role = await prisma.customRole.upsert({
    where: { tenantId_name: { tenantId, name: ROLE_NAME } },
    create: { tenantId, name: ROLE_NAME, preset: 'contributor' },
    update: { preset: 'contributor' },
  });

  for (const row of CONTRIBUTOR_MATRIX) {
    await prisma.rolePermission.upsert({
      where: { customRoleId_featureKey: { customRoleId: role.id, featureKey: row.featureKey } },
      create: { tenantId, customRoleId: role.id, ...row },
      update: { view: row.view, write: row.write, update: row.update, delete: row.delete },
    });
  }

  const adminId = await upsertUserByName(tenantId, ADMIN_NAME, 'tenant_admin', '4321', null);
  const empId = await upsertUserByName(tenantId, EMP_NAME, 'employee', '2020', role.id);

  console.log('✅ RBAC Wave 3 fixtures ready on `demo` tenant:');
  console.log(`   custom role   : ${ROLE_NAME} (contributor) -> ${role.id}`);
  console.log(`   tenant_admin  : "${ADMIN_NAME}" / PIN 4321 -> ${adminId}`);
  console.log(`   employee+role : "${EMP_NAME}" / PIN 2020 (customRoleId=${role.id}) -> ${empId}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err: unknown) => {
    console.error(err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
