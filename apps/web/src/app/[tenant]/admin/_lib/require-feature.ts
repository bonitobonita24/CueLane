// Wave 1 (Rule 34 Part B) — per-page server guard for the Admin Panel. Defense-in-depth beneath
// the sidebar nav filter (visibleAdminTabs) and the tRPC matrixProcedure: all three read the SAME
// resolver, so a caller can never reach a feature's page/data it lacks `view` on — even by typing
// the URL directly. Kept here (server-only) so every admin sub-page is a one-line guard call.
import { redirect } from 'next/navigation';
import { prismaRaw, type FeatureKey } from '@cuelane/db';
import { auth } from '@/server/auth';
import { resolvePrincipal, hasPermission, type Principal } from '@/lib/rbac';

/**
 * Resolves the caller's DB Principal and redirects unless they hold `view` on `feature`:
 *   - no/empty session id            → /login
 *   - no user row (platform manager) → /{tenant}/kiosk  (never belongs in a tenant admin page)
 *   - lacks view on the feature      → /{tenant}/admin   (the root then routes them to their
 *                                        first visible tab — loop-safe, the root never redirects
 *                                        to a sub-page the caller can't view)
 * Returns the Principal so a caller can reuse it (e.g. to further tier-gate in-page).
 */
export async function requireFeatureView(tenantSlug: string, feature: FeatureKey): Promise<Principal> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (userId == null || userId === '') {
    redirect('/login');
  }

  let principal: Principal;
  try {
    principal = await resolvePrincipal(userId, prismaRaw);
  } catch {
    redirect(`/${tenantSlug}/kiosk`);
  }

  if (!hasPermission(principal, feature, 'view')) {
    redirect(`/${tenantSlug}/admin`);
  }
  return principal;
}
