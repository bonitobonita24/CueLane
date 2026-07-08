// Wave 7.6-T6 — Windows admin list. Same shape as services-client.tsx, simpler (no icon/color/
// number). Driven through the `window`/`tenantAdmin` tRPC routers via the vanilla proxy client.
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
import type { CreateWindowInput } from '@cuelane/shared';
import { DataTable } from '../_components/DataTable';
import { UsageMeter } from '../_components/UsageMeter';
import { isAddDisabled } from '../_lib/limits';
import { WindowFormDialog } from './WindowFormDialog';

interface WindowRow {
  id: string;
  name: string;
}

interface UsageState {
  count: number;
  limit: number | null;
}

const client = createClient('/api/trpc');

export function WindowsClient() {
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WindowRow | null>(null);
  const [deleting, setDeleting] = useState<WindowRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const [list, usageResult] = await Promise.all([
      client.window.list.query(),
      client.tenantAdmin.getUsage.query(),
    ]);
    setWindows(list);
    setUsage(usageResult.windows);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Failed to load windows.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: WindowRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: CreateWindowInput) => {
    setSubmitting(true);
    try {
      if (editing) {
        await client.window.update.mutate({ id: editing.id, ...values });
        toast.success('Window updated.');
      } else {
        await client.window.create.mutate(values);
        toast.success('Window added.');
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
      await client.window.delete.mutate({ id: deleting.id });
      toast.success('Window deleted.');
      setDeleting(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const addDisabled = usage != null && isAddDisabled(usage);

  const columns: ColumnDef<WindowRow>[] = [
    { accessorKey: 'name', header: 'Name' },
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
          {usage != null && <UsageMeter label="Windows" count={usage.count} limit={usage.limit} />}
        </div>
        <Button onClick={openCreate} disabled={addDisabled} title={addDisabled ? 'Free tier limit reached' : undefined}>
          Add Window
        </Button>
      </div>

      <DataTable columns={columns} data={windows} emptyMessage={loading ? 'Loading…' : 'No windows yet.'} />

      <WindowFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editing ? 'edit' : 'create'}
        initialValues={editing ?? undefined}
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
