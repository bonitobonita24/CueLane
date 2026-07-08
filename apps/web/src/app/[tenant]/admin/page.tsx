// Wave 7.7a-T3 — Admin index now renders the Dashboard landing directly (previously redirected to
// /services — Wave 7.6-T5). The layout already applied the role/tier guard.
import { DashboardClient } from './dashboard-client';

export default function AdminPage() {
  return <DashboardClient />;
}
