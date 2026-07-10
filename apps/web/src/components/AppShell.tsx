// Wave 8-sidebar — the shared left-sidebar APP-SHELL for CueLane's purpose-driven management
// surfaces (Tenant Admin, Super Admin, Employee Station). This is the first embodiment of the
// global design archetype: a persistent left sidebar (off-canvas sheet on mobile) + a large
// right content area with the Entry-1 gutter container. Marketing/landing + the immersive
// Kiosk/Display surfaces do NOT use this shell.
//
// Client component: it owns the active-nav highlight (usePathname) and the sidebar open/collapse
// state (SidebarProvider context, cookie-persisted). Server layouts stay thin — they resolve the
// role/tier/brand server-side and pass a pre-filtered, fully-serializable `navItems` list down,
// exactly like the old server-layout → client-AdminTabsNav split. Icons are mapped id→component
// HERE (a function/component can't cross the server→client prop boundary), so `navItems` carries
// only strings.
//
// Imported from '@cuelane/ui/sidebar' (a dedicated subpath export) — NEVER the '@cuelane/ui'
// barrel: the sidebar is a client/context component and re-exporting it through the barrel breaks
// every RSC that imports the barrel ("e.createContext is not a function" at `next build`). See
// packages/ui/src/index.ts NOTE + packages/ui/package.json exports.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Gauge,
  Image as ImageIcon,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Megaphone,
  Palette,
  PanelsTopLeft,
  Printer,
  Users,
} from 'lucide-react';
import { cn } from '@cuelane/ui';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@cuelane/ui/sidebar';

export interface AppShellNavItem {
  /** Stable id — also the icon-map key. */
  id: string;
  label: string;
  /** Fully-resolved absolute href (server prefixes the tenant slug). */
  href: string;
  /** When true the item is active only on an exact pathname match (used for a section ROOT like
   *  the admin Dashboard at `/{tenant}/admin`, which is a prefix of every other admin href). */
  exact?: boolean;
}

// id → lucide icon. Covers every nav id across all three surfaces; unknown ids fall back to a
// neutral dot-less icon so a new nav item never crashes the shell.
const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  services: ListChecks,
  windows: PanelsTopLeft,
  users: Users,
  media: ImageIcon,
  settings: Printer,
  theme: Palette,
  usage: Gauge,
  tenants: Building2,
  'system-ads': Megaphone,
};

export interface AppShellProps {
  /** Brand/tenant name shown in the sidebar header (resolved server-side). */
  brandName: string;
  /** Small line under the brand name, e.g. "Admin Panel" or "Powerbyte staff". */
  brandSubtitle?: string;
  /** Top-bar title, e.g. "Admin Panel". */
  title: string;
  /** Top-bar subtitle line, e.g. "Tenant: demo". */
  subtitle?: React.ReactNode;
  /** Optional label above the nav group. */
  navLabel?: string;
  navItems: AppShellNavItem[];
  /** Sidebar collapse behaviour. 'icon' keeps a thin icon rail (Station); 'offcanvas' hides it
   *  entirely when collapsed (Admin / Super Admin default). */
  collapsible?: 'offcanvas' | 'icon';
  /** Initial expanded/collapsed state. Station passes false so the console opens with max working
   *  area (thin rail); Admin/Super Admin default open. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function AppShell({
  brandName,
  brandSubtitle,
  title,
  subtitle,
  navLabel,
  navItems,
  collapsible = 'offcanvas',
  defaultOpen = true,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const brandInitial = brandName.trim().charAt(0).toUpperCase();

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible={collapsible}>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              {brandInitial === '' ? 'C' : brandInitial}
            </div>
            <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold leading-tight">{brandName}</span>
              {brandSubtitle != null && brandSubtitle !== '' ? (
                <span className="truncate text-xs text-sidebar-foreground/70">{brandSubtitle}</span>
              ) : null}
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            {navLabel != null && navLabel !== '' ? (
              <SidebarGroupLabel>{navLabel}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = NAV_ICONS[item.id] ?? LayoutDashboard;
                  const isActive =
                    pathname === item.href ||
                    (item.exact !== true && pathname.startsWith(`${item.href}/`));
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link href={item.href} aria-current={isActive ? 'page' : undefined}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        {/* Slim sticky top bar inside the inset — carries the hamburger trigger + surface title. */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
          <SidebarTrigger className={cn('-ml-1')} />
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-sm font-semibold leading-tight tracking-tight">{title}</h1>
            {subtitle != null ? (
              <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
            ) : null}
          </div>
        </header>
        {/* Entry-1 container/gutter — readable content never full-bleed, safe gutter every
            breakpoint including mobile. */}
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
