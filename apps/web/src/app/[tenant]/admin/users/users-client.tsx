// Wave 7.6-T7 — Users admin list. DataTable + create/edit dialog + delete confirm, driven through
// the `user`/`service`/`tenantAdmin` tRPC routers via the vanilla proxy client. tenant-agnostic —
// tenantId is never known/sent client-side.
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
import { Role } from '@cuelane/shared';
import { DataTable } from '../_components/DataTable';
import { UsageMeter } from '../_components/UsageMeter';
import { isAddDisabled } from '../_lib/limits';
import { UserFormDialog, type UserFormValues } from './UserFormDialog';

interface UserRow {
  id: string;
  name: string;
  role: Role;
  serviceIds: string[];
}

interface ServiceOption {
  id: string;
  name: string;
}

interface UsageState {
  count: number;
  limit: number | null;
}

const client = createClient('/api/trpc');

export function UsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const [userList, serviceList, usageResult] = await Promise.all([
      client.user.list.query(),
      client.service.list.query(),
      client.tenantAdmin.getUsage.query(),
    ]);
    // Server returns `role` as a plain string column (Prisma), always one of the Role enum values.
    setUsers(userList.map((u) => ({ ...u, role: u.role as Role })));
    setServices(serviceList.map((s) => ({ id: s.id, name: s.name })));
    setUsage(usageResult.users);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Failed to load users.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: UserFormValues) => {
    setSubmitting(true);
    try {
      if (editing) {
        await client.user.update.mutate({
          id: editing.id,
          name: values.name,
          ...(values.pin !== '' ? { pin: values.pin } : {}),
          services: values.services,
        });
        toast.success('User updated.');
      } else {
        await client.user.create.mutate({
          name: values.name,
          role: values.role,
          pin: values.pin,
          services: values.services,
        });
        toast.success('User added.');
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
      await client.user.delete.mutate({ id: deleting.id });
      toast.success('User deleted.');
      setDeleting(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const addDisabled = usage != null && isAddDisabled(usage);

  const columns: ColumnDef<UserRow>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      id: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.role === Role.TenantAdmin || row.original.role === Role.TenantSuperadmin
              ? 'default'
              : 'secondary'
          }
        >
          {row.original.role}
        </Badge>
      ),
    },
    {
      id: 'services',
      header: 'Services',
      cell: ({ row }) =>
        row.original.serviceIds.length > 0 ? (
          <span className="text-sm text-muted-foreground">{row.original.serviceIds.map(serviceName).join(', ')}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
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
          {usage != null && <UsageMeter label="Users" count={usage.count} limit={usage.limit} />}
        </div>
        <Button onClick={openCreate} disabled={addDisabled} title={addDisabled ? 'Free tier limit reached' : undefined}>
          Add User
        </Button>
      </div>

      <DataTable columns={columns} data={users} emptyMessage={loading ? 'Loading…' : 'No users yet.'} />

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editing ? 'edit' : 'create'}
        initialValues={
          editing
            ? { name: editing.name, role: editing.role as Role.Employee | Role.TenantAdmin, pin: '', services: editing.serviceIds }
            : undefined
        }
        serviceOptions={services}
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
