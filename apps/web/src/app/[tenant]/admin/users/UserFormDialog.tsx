// Wave 7.6-T7 — Create/Edit User dialog. Create requires name+role+pin+services (matches
// createUserSchema); edit omits role (userRouter.update has no role-change procedure this wave —
// updateUserRoleSchema exists in @cuelane/shared but no router exposes it yet, so this dialog only
// offers what the backend actually supports) and makes pin OPTIONAL (blank = keep the existing
// bcrypt hash — server's updateUserSchema already treats `pin: undefined` as "no change").
'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Role } from '@cuelane/shared';
import {
  Button,
  Checkbox,
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
} from '@cuelane/ui';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@cuelane/ui/form';

const PIN_RE = /^\d{4,6}$/;
// Radix `Select.Item` forbids an empty-string `value` — this sentinel represents "— None —" in
// the UI only; translated to/from `''` on the form field (never sent to the server as a literal).
const NONE_VALUE = '__none__';

// customRoleId: '' sentinel = "— None —" in the Select (Radix Select rejects an empty-string
// item value); coerced to `null` at submit time in the parent (users-client.tsx).
const createSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum([Role.Employee, Role.TenantAdmin]),
  pin: z.string().regex(PIN_RE, 'PIN must be 4–6 digits'),
  services: z.array(z.string()).default([]),
  customRoleId: z.string().default(''),
});

const editSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum([Role.Employee, Role.TenantAdmin]),
  pin: z.union([z.literal(''), z.string().regex(PIN_RE, 'PIN must be 4–6 digits')]),
  services: z.array(z.string()).default([]),
  customRoleId: z.string().default(''),
});

export interface UserFormValues {
  name: string;
  role: Role.Employee | Role.TenantAdmin;
  pin: string;
  services: string[];
  /** '' = no custom role (— None —). Only meaningful when role === Role.Employee. */
  customRoleId: string;
}

export interface UserServiceOption {
  id: string;
  name: string;
}

export interface CustomRoleOption {
  id: string;
  name: string;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: UserFormValues | undefined;
  serviceOptions: UserServiceOption[];
  customRoleOptions: CustomRoleOption[];
  submitting: boolean;
  onSubmit: (values: UserFormValues) => Promise<void>;
}

const DEFAULTS: UserFormValues = { name: '', role: Role.Employee, pin: '', services: [], customRoleId: '' };

export function UserFormDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  serviceOptions,
  customRoleOptions,
  submitting,
  onSubmit,
}: UserFormDialogProps) {
  const schema = useMemo(() => (mode === 'create' ? createSchema : editSchema), [mode]);
  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? DEFAULTS,
  });

  useEffect(() => {
    if (open) {
      form.reset(initialValues ?? DEFAULTS);
    }
  }, [open, initialValues, form]);

  // Watched so the custom-role picker reacts live when the Role select changes in create mode.
  const watchedRole = form.watch('role');
  const isEmployee = watchedRole === Role.Employee;

  // Role no longer Employee → customRoleId is meaningless server-side (forced to null there too);
  // clear it here so a stale selection never silently resubmits.
  useEffect(() => {
    if (!isEmployee && form.getValues('customRoleId') !== '') {
      form.setValue('customRoleId', '');
    }
  }, [isEmployee, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add User' : 'Edit User'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Juan Dela Cruz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === 'create' && (
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={Role.Employee}>Employee</SelectItem>
                        <SelectItem value={Role.TenantAdmin}>Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PIN (4–6 digits){mode === 'edit' && ' — leave blank to keep current'}</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" maxLength={6} placeholder={mode === 'edit' ? '••••' : '0000'} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEmployee && (
              <FormField
                control={form.control}
                name="customRoleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Role</FormLabel>
                    <Select value={field.value === '' ? NONE_VALUE : field.value} onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="— None —" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>— None —</SelectItem>
                        {customRoleOptions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="services"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Services</FormLabel>
                  <div className="space-y-2 rounded-md border p-3">
                    {serviceOptions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No services yet — add one on the Services tab first.</p>
                    )}
                    {serviceOptions.map((svc) => {
                      const checked = field.value.includes(svc.id);
                      return (
                        <div key={svc.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`svc-${svc.id}`}
                            checked={checked}
                            onCheckedChange={(next) => {
                              field.onChange(
                                next === true
                                  ? [...field.value, svc.id]
                                  : field.value.filter((id: string) => id !== svc.id),
                              );
                            }}
                          />
                          <Label htmlFor={`svc-${svc.id}`} className="cursor-pointer font-normal">
                            {svc.name}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {mode === 'create' ? 'Add User' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
