// Wave 7.2-T3 — tenant slug→id resolution shared by the SSE stream route handler. Split out of
// route.ts because Next.js App Router route files may ONLY export HTTP-method handlers +
// `dynamic`/`runtime`/etc config — any other named export fails the build ("is not a valid Route
// export field").
import { prismaRaw } from '@cuelane/db';

/**
 * Resolves a tenant slug to its tenantId, exactly like `kioskProcedure`
 * (apps/web/src/server/trpc/trpc.ts) — UNGUARDED `prismaRaw` client, no AsyncLocalStorage tenant
 * context required for this single lookup. Returns null for an unknown OR non-active tenant (the
 * caller maps that to a 404 — never streams a suspended tenant's channel).
 */
export async function resolveTenantIdBySlug(slug: string): Promise<string | null> {
  const tenant = await prismaRaw.tenant.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (tenant == null || tenant.status !== 'active') return null;
  return tenant.id;
}
