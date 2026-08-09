// Wave 7.6-T7 — Users admin tab. Wave 1 (Rule 34 Part B): view-access-guarded on the OWNER_ONLY
// `users` feature — hasPermission grants it to tenant_superadmin / tenant_manager only (tenant_admin
// and every custom role are hard-denied, matching userManagementProcedure on the user router). A
// tenant_admin who URL-hops here is bounced to the admin root.
import { FeatureKey } from '@cuelane/db';
import { requireFeatureView } from '../_lib/require-feature';
import { UsersClient } from './users-client';

export default async function UsersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requireFeatureView(tenant, FeatureKey.users);
  return <UsersClient />;
}
