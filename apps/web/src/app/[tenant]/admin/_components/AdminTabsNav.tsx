// Wave 7.6-T5 — Admin Panel tab navigation. Client component (needs usePathname for the active
// tab highlight); receives its tab list pre-filtered by tier from the server layout so it never
// has to know about tier/gating itself (tenant-agnostic, dumb rendering only).
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@cuelane/ui';
import type { AdminTab } from '../_lib/access';

interface AdminTabsNavProps {
  tenantSlug: string;
  tabs: AdminTab[];
}

export function AdminTabsNav({ tenantSlug, tabs }: AdminTabsNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-b px-4 sm:px-6">
      {tabs.map((tab) => {
        // Wave 7.7a-T3: href === '' is the admin ROOT (Dashboard tab) — render without a
        // trailing slash (`/{tenant}/admin`, not `/{tenant}/admin/`).
        const href = tab.href === '' ? `/${tenantSlug}/admin` : `/${tenantSlug}/admin/${tab.href}`;
        const isActive = pathname === href || (tab.href !== '' && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={tab.id}
            href={href}
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
