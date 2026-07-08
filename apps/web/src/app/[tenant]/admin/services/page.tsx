// Wave 7.6-T6 — Services admin tab. AdminLayout already applied the Admin/SuperAdmin role guard;
// this page is a thin server→client handoff (tenant slug only — no tenantId, no server data
// fetch: the client component fetches via the tenant-scoped `service`/`tenantAdmin` tRPC
// procedures, which resolve tenantId from the session on every call).
import { ServicesClient } from './services-client';

export default function ServicesPage() {
  return <ServicesClient />;
}
