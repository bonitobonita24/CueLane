// Wave 7.8-T3 — Super Admin platform analytics dashboard. Replaces the Wave 7.7-scaffold
// placeholder (role-guard now lives in the shared layout.tsx). Server shell only — the client
// component does the data fetch via the vanilla tRPC proxy (no react-query provider in this app).
import { DashboardClient } from './dashboard-client';

export default function SuperAdminDashboardPage() {
  return <DashboardClient />;
}
