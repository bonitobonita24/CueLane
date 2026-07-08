// Wave 7.6-T6 — Create/Edit Window dialog. Windows are named only (no numbering) — a single
// `name` field via RHF + Zod (createWindowSchema, shared with the server).
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createWindowSchema, type CreateWindowInput } from '@cuelane/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@cuelane/ui';
// Imported from the dedicated subpath, not the main barrel — see index.ts's note on
// react-hook-form's "react-server" export condition.
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@cuelane/ui/form';

interface WindowFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: CreateWindowInput | undefined;
  submitting: boolean;
  onSubmit: (values: CreateWindowInput) => Promise<void>;
}

const DEFAULTS: CreateWindowInput = { name: '' };

export function WindowFormDialog({ open, onOpenChange, mode, initialValues, submitting, onSubmit }: WindowFormDialogProps) {
  const form = useForm<CreateWindowInput>({
    resolver: zodResolver(createWindowSchema),
    defaultValues: initialValues ?? DEFAULTS,
  });

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Window' : 'Edit Window'}</DialogTitle>
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
                    <Input placeholder="e.g. Window 1" {...field} />
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
                {mode === 'create' ? 'Add Window' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
