import { z } from 'zod';
import {
  Role,
  TenantTier,
  TenantStatus,
  VideoMode,
  TicketStatus,
  MediaType,
  AdType,
} from '../types/index.js';

// ─── Shared primitives ───────────────────────────────────────────────────────

const idSchema = z.string().cuid();
const pinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits');

// ─── Tenant ──────────────────────────────────────────────────────────────────

const printerConfigSchema = z.object({
  paperWidth: z.string().optional(),
  marginTop: z.number().int().nonnegative().optional(),
  marginBottom: z.number().int().nonnegative().optional(),
  autoCut: z.boolean().optional(),
  footerText: z.string().max(200).optional(),
});

const tenantSettingsSchema = z.object({
  theme: z.string().optional(),
  printerConfig: printerConfigSchema.optional(),
  tickerText: z.string().max(500).optional(),
  businessName: z.string().max(100).optional(),
  videoMode: z.nativeEnum(VideoMode).optional(),
  liveStreamUrl: z.string().url().optional(),
});

export const createTenantSchema = z.object({
  companyName: z.string().min(1).max(100),
  tagline: z.string().max(200),
  tier: z.nativeEnum(TenantTier).default(TenantTier.Free),
  settings: tenantSettingsSchema.optional(),
});

export const updateTenantSettingsSchema = z.object({
  companyName: z.string().min(1).max(100).optional(),
  tagline: z.string().max(200).optional(),
  logoUrl: z.string().url().nullable().optional(),
  settings: tenantSettingsSchema.optional(),
});

export const updateTenantStatusSchema = z.object({
  tenantId: idSchema,
  status: z.nativeEnum(TenantStatus),
});

// ─── Service (Transaction Type) ──────────────────────────────────────────────

export const createServiceSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().emoji().max(2),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color'),
  avgTime: z.number().int().positive().max(480), // max 8 hours
});

export const updateServiceSchema = createServiceSchema.partial();

// ─── Window ──────────────────────────────────────────────────────────────────

export const createWindowSchema = z.object({
  name: z.string().min(1).max(80),
});

export const updateWindowSchema = createWindowSchema.partial();

// ─── User ────────────────────────────────────────────────────────────────────

// SuperAdmin role is not assignable via tenant-level user management
const tenantRoleSchema = z.enum([Role.Employee, Role.Admin]);

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  role: tenantRoleSchema,
  pin: pinSchema,
  services: z.array(idSchema).default([]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pin: pinSchema.optional(),
  services: z.array(idSchema).optional(),
});

export const updateUserRoleSchema = z.object({
  userId: idSchema,
  role: tenantRoleSchema,
});

// ─── Ticket ──────────────────────────────────────────────────────────────────

export const createTicketSchema = z.object({
  serviceId: idSchema,
  priority: z.boolean().default(false),
});

export const updateTicketStatusSchema = z.object({
  ticketId: z.string().min(1), // P-NNN or {svcNum}-NNN format
  status: z.nativeEnum(TicketStatus),
  windowId: idSchema.nullable().optional(),
  servedBy: idSchema.nullable().optional(),
});

export const transferTicketSchema = z
  .object({
    ticketId: z.string().min(1),
    toWindowId: idSchema,
    returnAfterDone: z.boolean().default(false),
    returnToWindowId: idSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.returnAfterDone && v.returnToWindowId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['returnToWindowId'],
        message: 'returnToWindowId is required when returnAfterDone is true',
      });
    }
  });

export const recallTicketSchema = z.object({
  ticketId: z.string().min(1),
  priority: z.boolean().default(false), // true = Priority Recall (auto-skips current)
});

// ─── PlaylistEntry ───────────────────────────────────────────────────────────

export const createPlaylistEntrySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(MediaType.YouTube),
    title: z.string().min(1).max(200),
    videoId: z.string().min(1),
    isLive: z.boolean().default(false),
  }),
  z.object({
    type: z.literal(MediaType.Local),
    title: z.string().min(1).max(200),
    storageKey: z.string().min(1),
    fileName: z.string().min(1),
    fileSize: z.number().int().positive(),
    fileExt: z.string().min(1).max(10),
  }),
]);

// isLive excluded from update — callers must recreate the entry to change type.
// Allowing isLive on a Local entry would corrupt the player's stream-vs-file logic.
export const updatePlaylistEntrySchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export const reorderPlaylistSchema = z.object({
  orderedIds: z.array(idSchema).min(1).max(500),
});

// ─── TenantAd (Premium, LIVE mode only) ─────────────────────────────────────

export const createTenantAdSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(AdType.YouTube),
    title: z.string().min(1).max(200),
    videoId: z.string().min(1),
    duration: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal(AdType.Uploaded),
    title: z.string().min(1).max(200),
    storageKey: z.string().min(1),
    fileName: z.string().min(1),
    fileSize: z.number().int().positive(),
    duration: z.number().int().positive().optional(),
  }),
]);

export const updateTenantAdSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  duration: z.number().int().positive().optional(),
});

export const reorderTenantAdsSchema = z.object({
  orderedIds: z.array(idSchema).min(1).max(100),
});

// ─── SystemAd (global, Super Admin only) ─────────────────────────────────────

export const createSystemAdSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(AdType.YouTube),
    title: z.string().min(1).max(200),
    videoId: z.string().min(1),
    duration: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal(AdType.Uploaded),
    title: z.string().min(1).max(200),
    storageKey: z.string().min(1),
    fileName: z.string().min(1),
    fileSize: z.number().int().positive(),
    duration: z.number().int().positive().optional(),
  }),
]);

export const updateSystemAdSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  duration: z.number().int().positive().optional(),
});

export const reorderSystemAdsSchema = z.object({
  orderedIds: z.array(idSchema).min(1).max(100),
});

// ─── Subscription ────────────────────────────────────────────────────────────

export const upgradeSubscriptionSchema = z.object({
  xenditPlanId: z.string().min(1),
  xenditCustomerId: z.string().min(1),
});

export const xenditWebhookSchema = z.object({
  event: z.enum([
    'recurring.plan.activated',
    'recurring.plan.inactivated',
    'recurring.cycle.succeeded',
    'recurring.cycle.failed',
  ]),
  data: z.object({
    id: z.string(),
    status: z.string().optional(),
    customer_id: z.string().optional(),
    plan_id: z.string().optional(),
  }),
});

// ─── PasswordResetToken ───────────────────────────────────────────────────────

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const consumePasswordResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

// ─── Inferred input types ─────────────────────────────────────────────────────

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;
export type UpdateTenantStatusInput = z.infer<typeof updateTenantStatusSchema>;

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export type CreateWindowInput = z.infer<typeof createWindowSchema>;
export type UpdateWindowInput = z.infer<typeof updateWindowSchema>;

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type TransferTicketInput = z.infer<typeof transferTicketSchema>;
export type RecallTicketInput = z.infer<typeof recallTicketSchema>;

export type CreatePlaylistEntryInput = z.infer<typeof createPlaylistEntrySchema>;
export type UpdatePlaylistEntryInput = z.infer<typeof updatePlaylistEntrySchema>;

export type CreateTenantAdInput = z.infer<typeof createTenantAdSchema>;
export type UpdateTenantAdInput = z.infer<typeof updateTenantAdSchema>;

export type CreateSystemAdInput = z.infer<typeof createSystemAdSchema>;
export type UpdateSystemAdInput = z.infer<typeof updateSystemAdSchema>;

export type UpgradeSubscriptionInput = z.infer<typeof upgradeSubscriptionSchema>;
export type XenditWebhookInput = z.infer<typeof xenditWebhookSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ConsumePasswordResetInput = z.infer<typeof consumePasswordResetSchema>;
