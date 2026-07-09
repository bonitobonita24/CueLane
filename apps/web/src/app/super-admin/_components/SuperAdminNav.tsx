// Wave 7.8-T3 — Super Admin nav. Mirrors [tenant]/admin/_components/AdminTabsNav.tsx exactly
// (client component for the active-tab highlight), just with a fixed 3-tab list instead of a
// tier-filtered one (Super Admin has no tier concept — it's platform-global).
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@cuelane/ui';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', href: '/super-admin/dashboard' },
  { id: 'tenants', label: 'Tenants', href: '/super-admin/tenants' },
  { id: 'system-ads', label: 'System Ads', href: '/super-admin/system-ads' },
] as const;

export function SuperAdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Super Admin sections" className="flex gap-1 overflow-x-auto border-b px-4 sm:px-6">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors motion-reduce:transition-none',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
