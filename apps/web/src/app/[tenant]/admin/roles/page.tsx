// RBAC Wave 2 (Rule 34 Part B) — Roles admin tab. Server-guarded by the view-access matrix
// (requireFeatureView) — defense-in-depth beneath the nav filter + the roles router's own
// userManagementProcedure gate (owner-only). Thin server→client handoff otherwise.
import { FeatureKey } from '@cuelane/db';
import { requireFeatureView } from '../_lib/require-feature';
import { RolesClient } from './roles-client';

export default async function RolesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requireFeatureView(tenant, FeatureKey.roles);
  return <RolesClient />;
}
