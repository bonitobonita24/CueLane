import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@cuelane/db';
import { resolveThemeVars, type ThemeVars } from '@cuelane/shared';

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata({
  params,
}: TenantLayoutProps): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenantRecord = await prisma.tenant.findUnique({
    where: { slug },
    select: { companyName: true },
  });
  return {
    title: tenantRecord ? `${tenantRecord.companyName} — CueLane` : 'CueLane',
  };
}

// Maps ThemeVars keys (camelCase) to their CSS custom-property names (kebab-case, matching
// globals.css's `:root`/`.dark` token names) — e.g. `primaryForeground` → `--primary-foreground`.
function themeVarsToStyle(vars: ThemeVars): CSSProperties {
  const style: Record<string, string> = {};
  const entries = Object.entries(vars) as Array<[string, string]>;
  for (const [key, value] of entries) {
    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    style[`--${kebab}`] = value;
  }
  return style;
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { tenant: slug } = await params;

  // Verify tenant exists — middleware also guards this, but defense-in-depth. This layout wraps
  // EVERY public + authed surface under /{tenant}/ (Kiosk, Station, Big Display, Admin), none of
  // which necessarily have a session (Kiosk/Display are public, no login) — so, like
  // kiosk/page.tsx and display/page.tsx, this reads `Tenant` directly via the plain `prisma`
  // client with no `withTenantContext` wrap. That's safe here ONLY because `Tenant` is a
  // GLOBAL_MODEL that bypasses the L6 tenant guard (see packages/db tenant-guard) — never do this
  // for a tenant-scoped model.
  const tenantRecord = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, status: true, settings: true },
  });

  if (!tenantRecord || tenantRecord.status !== 'active') {
    notFound();
  }

  // Wave 7.7b-T2 — resolve the tenant's theme SERVER-SIDE and inject it as inline CSS custom
  // properties on this wrapper. This lands in the server-rendered HTML (no client effect / no
  // `useEffect` setProperty), so there is no flash of the previous/default theme on first paint.
  // `settings` is Prisma's untyped Json column — `resolveThemeVars` takes `unknown` and is
  // defensive against every legacy/malformed shape, so no narrowing is needed here.
  const themeSetting = (tenantRecord?.settings as { theme?: unknown } | null)?.theme;
  const vars = resolveThemeVars(themeSetting);

  return <div style={themeVarsToStyle(vars)}>{children}</div>;
}
