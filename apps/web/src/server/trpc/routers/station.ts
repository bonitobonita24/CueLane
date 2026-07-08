// Wave 7.4-T1 — stationRouter. Employee Station's per-user selected-window session, backed by
// Valkey (server/station/session.ts) — NOT a Postgres row, this is UI state, not domain state.
// Reuses queueRouter's `staffProcedure` (Employee/Admin-only, tenant-scoped) so this shares the
// exact same auth/tenant guarantees as every other station-facing procedure.
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { setStationWindowSchema } from '@cuelane/shared';
import { prisma } from '@cuelane/db';
import { createTRPCRouter } from '../trpc';
import { staffProcedure } from './queue';
import { getStationWindow, setStationWindow } from '@/server/station/session';

export const stationRouter = createTRPCRouter({
  // Reads the calling employee's currently-selected window (survives a page refresh).
  getWindow: staffProcedure.input(z.void()).query(async ({ ctx }) => {
    const windowId = await getStationWindow(ctx.tenantId, ctx.userId);
    return { windowId };
  }),

  // Persists the calling employee's selected window. Validates the window actually belongs to
  // this tenant first — never trust a client-supplied id blindly (L6 tenant-isolation lesson).
  setWindow: staffProcedure.input(setStationWindowSchema).mutation(async ({ ctx, input }) => {
    const window = await prisma.window.findFirst({
      where: { id: input.windowId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (window == null) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown window.' });
    }

    await setStationWindow(ctx.tenantId, ctx.userId, input.windowId);
    return { windowId: input.windowId };
  }),
});
