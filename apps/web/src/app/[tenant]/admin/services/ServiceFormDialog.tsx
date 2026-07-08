// Wave 7.6-T6 — Create/Edit Service dialog. RHF + Zod (createServiceSchema, shared with the
// server), icon picker (SERVICE_ICON_OPTIONS), color picker (SERVICE_COLOR_OPTIONS), a read-only
// next-number preview on create. One component for both modes — `mode='edit'` seeds
// `defaultValues` and changes the submit label/handler.
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createServiceSchema, SERVICE_ICON_OPTIONS, SERVICE_COLOR_OPTIONS, type CreateServiceInput } from '@cuelane/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from '@cuelane/ui';
// Imported from the dedicated subpath, not the main barrel — see index.ts's note on
// react-hook-form's "react-server" export condition.
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@cuelane/ui/form';

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: CreateServiceInput | undefined;
  nextNumberPreview?: number | undefined;
  submitting: boolean;
  onSubmit: (values: CreateServiceInput) => Promise<void>;
}

const DEFAULTS: CreateServiceInput = {
  name: '',
  icon: SERVICE_ICON_OPTIONS[0],
  color: SERVICE_COLOR_OPTIONS[0],
  avgTime: 5,
};

export function ServiceFormDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  nextNumberPreview,
  submitting,
  onSubmit,
}: ServiceFormDialogProps) {
  const form = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: initialValues ?? DEFAULTS,
  });

  // Re-seed the form whenever the dialog opens for a (possibly different) service.
  useEffect(() => {
    if (open) {
      form.reset(initialValues ?? DEFAULTS);
    }
  }, [open, initialValues, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Service' : 'Edit Service'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {mode === 'create' && nextNumberPreview != null && (
              <p className="text-sm text-muted-foreground">
                Will be assigned <span className="font-medium text-foreground">#{nextNumberPreview}</span>.
              </p>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Cash Deposit" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="avgTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Average time (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={480}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="Icon">
                      {SERVICE_ICON_OPTIONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          role="radio"
                          aria-checked={field.value === icon}
                          onClick={() => field.onChange(icon)}
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-colors motion-reduce:transition-none',
                            field.value === icon ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent',
                          )}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Color">
                      {SERVICE_COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          role="radio"
                          aria-checked={field.value === color}
                          aria-label={color}
                          onClick={() => field.onChange(color)}
                          style={{ backgroundColor: color }}
                          className={cn(
                            'h-8 w-8 rounded-full ring-offset-2 transition-shadow motion-reduce:transition-none',
                            field.value === color ? 'ring-2 ring-foreground' : 'ring-1 ring-border',
                          )}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {mode === 'create' ? 'Add Service' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
