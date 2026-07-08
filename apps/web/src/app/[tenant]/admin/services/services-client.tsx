// Wave 7.6-T6 — Services admin list. DataTable + create/edit dialog + delete confirm, all driven
// through the `service`/`tenantAdmin` tRPC routers via the vanilla proxy client (no react-query
// provider in this app — matches station-client.tsx's pattern). tenant-agnostic: the client never
// knows or sends a tenantId — every procedure resolves it from the caller's session.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { createClient } from '@/lib/trpc';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@cuelane/ui';
import type { CreateServiceInput } from '@cuelane/shared';
import { DataTable } from '../_components/DataTable';
import { UsageMeter } from '../_components/UsageMeter';
import { isAddDisabled, nextNumberPreview } from '../_lib/limits';
import { ServiceFormDialog } from './ServiceFormDialog';

interface ServiceRow {
  id: string;
  number: number;
  name: string;
  icon: string;
  color: string;
  avgTime: number;
}

interface UsageState {
  count: number;
  limit: number | null;
}

const client = createClient('/api/trpc');

const columns: ColumnDef<ServiceRow>[] = [
  { accessorKey: 'number', header: '#' },
  {
    id: 'service',
    header: 'Service',
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span aria-hidden>{row.original.icon}</span>
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: row.original.color }}
          aria-hidden
        />
        {row.original.name}
      </span>
    ),
  },
  { accessorKey: 'avgTime', header: 'Avg. time (min)' },
];

export function ServicesClient() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [deleting, setDeleting] = useState<ServiceRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const [list, usageResult] = await Promise.all([
      client.service.list.query(),
      client.tenantAdmin.getUsage.query(),
    ]);
    setServices(list);
    setUsage(usageResult.services);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Failed to load services.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: ServiceRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: CreateServiceInput) => {
    setSubmitting(true);
    try {
      if (editing) {
        await client.service.update.mutate({ id: editing.id, ...values });
        toast.success('Service updated.');
      } else {
        await client.service.create.mutate(values);
        toast.success('Service added.');
      }
      setDialogOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await client.service.delete.mutate({ id: deleting.id });
      toast.success('Service deleted.');
      setDeleting(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const addDisabled = usage != null && isAddDisabled(usage);

  const tableColumns: ColumnDef<ServiceRow>[] = [
    ...columns,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(row.original)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs flex-1">
          {usage != null && <UsageMeter label="Services" count={usage.count} limit={usage.limit} />}
        </div>
        <Button onClick={openCreate} disabled={addDisabled} title={addDisabled ? 'Free tier limit reached' : undefined}>
          Add Service
        </Button>
      </div>

      <DataTable columns={tableColumns} data={services} emptyMessage={loading ? 'Loading…' : 'No services yet.'} />

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editing ? 'edit' : 'create'}
        initialValues={editing ?? undefined}
        nextNumberPreview={editing ? undefined : nextNumberPreview(services.map((s) => s.number))}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={submitting}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
