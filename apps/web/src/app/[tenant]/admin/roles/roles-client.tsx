// RBAC Wave 2 (Rule 34 Part B) — Custom-role builder list. Owner-only surface (server-guarded by
// requireFeatureView + the roles router's userManagementProcedure). DataTable + create/edit dialog
// + delete confirm, driven through the `roles` tRPC router via the vanilla proxy client — same
// pattern as services-client.tsx.
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
  Badge,
  Button,
} from '@cuelane/ui';
import type { CreateCustomRoleInput } from '@cuelane/shared';
import { DataTable } from '../_components/DataTable';
import { RoleFormDialog } from './RoleFormDialog';

interface RoleRow {
  id: string;
  name: string;
  preset: string;
  featureCount: number;
  userCount: number;
}

const client = createClient('/api/trpc');

function presetLabel(preset: string): string {
  return preset.charAt(0).toUpperCase() + preset.slice(1);
}

export function RolesClient() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const list = await client.roles.list.query();
    setRoles(list);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Failed to load roles.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const openCreate = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (row: RoleRow) => {
    setEditingId(row.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: CreateCustomRoleInput) => {
    setSubmitting(true);
    try {
      if (editingId != null) {
        await client.roles.update.mutate({ id: editingId, ...values });
        toast.success('Role updated.');
      } else {
        await client.roles.create.mutate(values);
        toast.success('Role created.');
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
      await client.roles.delete.mutate({ id: deleting.id });
      toast.success('Role deleted.');
      setDeleting(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<RoleRow>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      id: 'preset',
      header: 'Preset',
      cell: ({ row }) => <Badge variant="outline">{presetLabel(row.original.preset)}</Badge>,
    },
    { accessorKey: 'featureCount', header: 'Features' },
    { accessorKey: 'userCount', header: 'Users' },
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
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>New role</Button>
      </div>

      <DataTable columns={columns} data={roles} emptyMessage={loading ? 'Loading…' : 'No custom roles yet.'} />

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editingId != null ? 'edit' : 'create'}
        roleId={editingId}
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
