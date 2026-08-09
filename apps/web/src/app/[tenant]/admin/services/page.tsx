// Wave 7.6-T6 — Services admin tab. Wave 1 (Rule 34 Part B): server-guarded by the view-access
// matrix (requireFeatureView) — defense-in-depth beneath the nav filter + the service router's
// matrixProcedure. Thin server→client handoff otherwise; the client fetches via the tenant-scoped
// `service`/`tenantAdmin` tRPC procedures (tenantId resolved from the session on every call).
import { FeatureKey } from '@cuelane/db';
import { requireFeatureView } from '../_lib/require-feature';
import { ServicesClient } from './services-client';

export default async function ServicesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requireFeatureView(tenant, FeatureKey.services);
  return <ServicesClient />;
}
