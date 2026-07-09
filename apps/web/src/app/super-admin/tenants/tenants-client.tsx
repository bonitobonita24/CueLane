// Wave 7.8-T3 — Super Admin Tenants directory. Table of every registered tenant (slug/company/
// tier/status/counts) with a tier-toggle + suspend/reactivate action, each behind a confirm
// dialog (a manual tier/status override is a consequential, hard-to-undo-by-accident action).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/trpc';
import { TenantTier, TenantStatus } from '@cuelane/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cuelane/ui';

interface TenantRow {
  id: string;
  slug: string;
  companyName: string;
  tier: string;
  status: string;
  createdAt: string | Date;
  _count: { services: number; windows: number; users: number; tickets: number };
}

const client = createClient('/api/trpc');

export function TenantsClient() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const rows = await client.superAdmin.listTenants.query();
    setTenants(rows);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => toast.error('Failed to load tenants.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const toggleTier = useCallback(
    async (tenant: TenantRow) => {
      const nextTier = tenant.tier === 'premium' ? TenantTier.Free : TenantTier.Premium;
      setBusyId(tenant.id);
      try {
        await client.superAdmin.setTier.mutate({ tenantId: tenant.id, tier: nextTier });
        toast.success(`${tenant.companyName} moved to ${nextTier === TenantTier.Premium ? 'Premium' : 'Free'}.`);
        await refresh();
      } catch {
        toast.error('Failed to change tier.');
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const toggleStatus = useCallback(
    async (tenant: TenantRow) => {
      const nextStatus = tenant.status === 'suspended' ? TenantStatus.Active : TenantStatus.Suspended;
      setBusyId(tenant.id);
      try {
        await client.superAdmin.setStatus.mutate({ tenantId: tenant.id, status: nextStatus });
        toast.success(`${tenant.companyName} ${nextStatus === TenantStatus.Suspended ? 'suspended' : 'reactivated'}.`);
        await refresh();
      } catch {
        toast.error('Failed to change status.');
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Tenant Directory</h2>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Windows</TableHead>
              <TableHead>Services</TableHead>
              <TableHead>Tickets</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.companyName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{t.slug}</TableCell>
                <TableCell>
                  <Badge variant={t.tier === 'premium' ? 'default' : 'secondary'}>
                    {t.tier === 'premium' ? 'Premium' : 'Free'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={t.status === 'suspended' ? 'destructive' : 'outline'}>
                    {t.status === 'suspended' ? 'Suspended' : 'Active'}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">{t._count.users}</TableCell>
                <TableCell className="tabular-nums">{t._count.windows}</TableCell>
                <TableCell className="tabular-nums">{t._count.services}</TableCell>
                <TableCell className="tabular-nums">{t._count.tickets}</TableCell>
                <TableCell className="flex justify-end gap-2 text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={busyId === t.id}>
                        {t.tier === 'premium' ? 'Downgrade to Free' : 'Upgrade to Premium'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Change {t.companyName}&apos;s tier?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This manually overrides billing state — {t.companyName} will immediately
                          {t.tier === 'premium' ? ' lose Premium features and fall back to Free-tier limits.' : ' gain Premium features and limits.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void toggleTier(t)}>Confirm</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant={t.status === 'suspended' ? 'default' : 'destructive'}
                        size="sm"
                        disabled={busyId === t.id}
                      >
                        {t.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t.status === 'suspended' ? 'Reactivate' : 'Suspend'} {t.companyName}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t.status === 'suspended'
                            ? 'Restores access to the Admin Panel, Employee Station, Kiosk, and Big Display for this tenant.'
                            : 'Immediately blocks the Admin Panel, Employee Station, Kiosk, and Big Display for this tenant.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void toggleStatus(t)}>Confirm</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No tenants registered yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
