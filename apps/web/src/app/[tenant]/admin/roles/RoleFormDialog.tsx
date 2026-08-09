// RBAC Wave 2 (Rule 34 Part B) — Create/Edit custom-role dialog with the per-feature view-access
// matrix. Plain useState, NOT react-hook-form: the matrix is a dynamic Record<FeatureKey, {...}>
// keyed by WRITABLE_FEATURES, which doesn't map cleanly onto RHF's typed-field-path model (would
// need a runtime-generated field-path union). name/preset are simple enough that a second form
// library instance wasn't worth it — this mirrors the plain-useState shape roles-client.tsx and
// services-client.tsx already use for everything above the form layer.
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/trpc';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Checkbox,
} from '@cuelane/ui';
import { RolePreset, type CreateCustomRoleInput, type PermissionRowInput } from '@cuelane/shared';
import { FeatureKey, WRITABLE_FEATURES, FEATURE_LABELS, presetMatrix } from '@/lib/rbac';

type MatrixFlags = { view: boolean; write: boolean; update: boolean; delete: boolean };
type Matrix = Record<FeatureKey, MatrixFlags>;
// Shape of the rows `client.roles.get.query()` returns — @cuelane/db-typed (matches
// WRITABLE_FEATURES' own FeatureKey), as opposed to the @cuelane/shared-typed
// `PermissionRowInput` the create/update mutations expect. See matrixToArray's note below.
type FetchedPermissionRow = MatrixFlags & { featureKey: FeatureKey };

const PRESET_OPTIONS: { value: RolePreset; label: string }[] = [
  { value: RolePreset.Supervisor, label: 'Supervisor' },
  { value: RolePreset.Operator, label: 'Operator' },
  { value: RolePreset.Contributor, label: 'Contributor' },
  { value: RolePreset.Viewer, label: 'Viewer' },
];

const ACTIONS: { key: keyof MatrixFlags; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'write', label: 'Write' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
];

const client = createClient('/api/trpc');

function matrixFromRows(rows: FetchedPermissionRow[]): Matrix {
  const matrix = {} as Matrix;
  for (const featureKey of WRITABLE_FEATURES) {
    const row = rows.find((r) => r.featureKey === featureKey);
    matrix[featureKey] = {
      view: row?.view ?? false,
      write: row?.write ?? false,
      update: row?.update ?? false,
      delete: row?.delete ?? false,
    };
  }
  return matrix;
}

// presetMatrix() returns rows keyed by the @cuelane/db FeatureKey (WRITABLE_FEATURES' own type)
// and takes the @cuelane/db RolePreset — hence the cast at the call site, where the local
// `preset` state is typed against @cuelane/shared's mirror enum (see the module doc comment).
function matrixFromPreset(preset: RolePreset): Matrix {
  const rows = presetMatrix(preset);
  const matrix = {} as Matrix;
  for (const row of rows) {
    matrix[row.featureKey] = { view: row.view, write: row.write, update: row.update, delete: row.delete };
  }
  return matrix;
}

// @cuelane/shared cannot depend on @cuelane/db, so PermissionRowInput['featureKey'] is a
// structurally-identical-but-nominally-different enum from @cuelane/db's FeatureKey (both mirror
// the same schema.prisma string values — see packages/shared/src/types/index.ts). Same safe-cast
// pattern the roles router (apps/web/src/server/trpc/routers/roles.ts) already documents.
function matrixToArray(matrix: Matrix): PermissionRowInput[] {
  return WRITABLE_FEATURES.map((featureKey) => ({
    featureKey: featureKey as unknown as PermissionRowInput['featureKey'],
    ...matrix[featureKey],
  }));
}

const DEFAULT_PRESET = RolePreset.Viewer;

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** The role id being edited. Ignored in 'create' mode. */
  roleId?: string | null;
  submitting: boolean;
  onSubmit: (values: CreateCustomRoleInput) => Promise<void>;
}

export function RoleFormDialog({ open, onOpenChange, mode, roleId, submitting, onSubmit }: RoleFormDialogProps) {
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<RolePreset>(DEFAULT_PRESET);
  const [matrix, setMatrix] = useState<Matrix>(() => matrixFromPreset(DEFAULT_PRESET));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && roleId != null) {
      setLoading(true);
      void client.roles.get
        .query({ id: roleId })
        .then((role) => {
          setName(role.name);
          setPreset(role.preset as unknown as RolePreset);
          setMatrix(matrixFromRows(role.permissions));
        })
        .finally(() => setLoading(false));
    } else {
      setName('');
      setPreset(DEFAULT_PRESET);
      setMatrix(matrixFromPreset(DEFAULT_PRESET));
    }
  }, [open, mode, roleId]);

  const handlePresetChange = (value: string) => {
    const next = value as RolePreset;
    setPreset(next);
    setMatrix(matrixFromPreset(next));
  };

  const toggleCell = (featureKey: FeatureKey, action: keyof MatrixFlags) => {
    setMatrix((prev) => ({
      ...prev,
      [featureKey]: { ...prev[featureKey], [action]: !prev[featureKey][action] },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ name, preset, permissions: matrixToArray(matrix) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Role' : 'Edit Role'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Front Desk"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-preset">Preset</Label>
              <Select value={preset} onValueChange={handlePresetChange} disabled={loading}>
                <SelectTrigger id="role-preset">
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  {ACTIONS.map((a) => (
                    <TableHead key={a.key} className="text-center">
                      {a.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {WRITABLE_FEATURES.map((featureKey) => (
                  <TableRow key={featureKey}>
                    <TableCell>{FEATURE_LABELS[featureKey]}</TableCell>
                    {ACTIONS.map((a) => (
                      <TableCell key={a.key} className="text-center">
                        <Checkbox
                          checked={matrix[featureKey]?.[a.key] ?? false}
                          onCheckedChange={() => toggleCell(featureKey, a.key)}
                          disabled={loading}
                          aria-label={`${FEATURE_LABELS[featureKey]} — ${a.label}`}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loading}>
              {mode === 'create' ? 'Create Role' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
