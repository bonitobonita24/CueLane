// Wave 7.5-T1 — Big Display server shell. Public (no login — the wall screen has no session,
// same posture as kiosk/page.tsx). Resolves/guards the tenant by slug (defense-in-depth, same
// pattern as kiosk/page.tsx and station/page.tsx) then hands off to the client component, which
// fetches the rest of what it needs (branding, now-serving, up-next, totalWaiting) via the
// Wave 7.5-T0 `queue.state` public procedure and keeps it live via the Wave 7.2 SSE stream.
import { notFound } from 'next/navigation';
import { prisma } from '@cuelane/db';
import { DisplayClient } from './display-client';

interface DisplayPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function DisplayPage({ params }: DisplayPageProps) {
  const { tenant: tenantSlug } = await params;

  // Tenant is a GLOBAL_MODEL (bypasses the L6 guard) — a bare `prisma.tenant.findUnique` needs no
  // withTenantContext wrap, same as kiosk/page.tsx's identical existence/active-status re-check.
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { status: true },
  });

  if (tenant == null || tenant.status !== 'active') {
    notFound();
  }

  return <DisplayClient tenantSlug={tenantSlug} />;
}
