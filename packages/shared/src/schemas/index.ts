import { z } from 'zod';
import {
  Role,
  TenantTier,
  TenantStatus,
  VideoMode,
  TicketStatus,
  MediaType,
  AdType,
  THEME_PRESETS,
  SERVICE_ICON_OPTIONS,
  SERVICE_COLOR_OPTIONS,
} from '../types/index.js';

// ─── Shared primitives ───────────────────────────────────────────────────────

const idSchema = z.string().cuid();
const pinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits');

// Security: only https:// — prevents javascript: / data: XSS via URL fields.
// z.string().url() already validates URL format; this refine constrains the scheme.
const httpsUrlSchema = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://'), 'Only https:// URLs are accepted');

// Security: YouTube video IDs are exactly 11 chars [A-Za-z0-9_-]
// Prevents injection into iframe src attributes
const youtubeVideoIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{11}$/, 'Invalid YouTube video ID');

// Security: storage key is a server-generated opaque path (tenantId/entity/filename)
// Constrained to prevent path traversal — alphanumeric + safe path chars only
const storageKeySchema = z
  .string()
  .min(8)
  .max(512)
  .regex(/^[A-Za-z0-9_/-]+$/, 'Invalid storage key');

// Security: client-supplied filename — prevent path separators and null bytes
const fileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[^/\\\r\n\0]+$/, 'File name must not contain path separators');

// Security: allowlist of accepted file extensions matching inputs.yml allowed_mime_types
const fileExtSchema = z.enum([
  'mp4', 'mov', 'avi', 'mkv', 'webm',  // video
  'png', 'jpg', 'jpeg', 'gif', 'webp',  // image
  'pdf',                                  // document
]);

// ─── Tenant ──────────────────────────────────────────────────────────────────

// Decision 3 (docs/DECISIONS_LOG.md 2026-07-08) — `enabled` was written by seed.ts but missing
// from this schema, so `updateTenantSettings` could never round-trip a seeded printerConfig.
const printerConfigSchema = z.object({
  enabled: z.boolean().optional(),
  paperWidth: z.string().optional(),
  marginTop: z.number().int().nonnegative().optional(),
  marginBottom: z.number().int().nonnegative().optional(),
  autoCut: z.boolean().optional(),
  footerText: z.string().max(200).optional(),
});

// Decision 2 — theme is a THEME_PRESETS id string (back-compat: every tenant seeded before
// Wave 7.7b stores exactly this bare-string shape, e.g. 'indigo').
const themePresetIds = THEME_PRESETS.map((t) => t.id) as [string, ...string[]];
const themeSchema = z.enum(themePresetIds);

// Wave 7.7b — Premium custom 9-color theme. Each value MUST be a bare HSL triplet ("H S% L%",
// no `hsl()` wrapper) — the exact shape injected verbatim into a server-rendered inline `style`
// attribute (apps/web `[tenant]/layout.tsx`), so this regex is a security gate (attack-informed
// hardening — CSS-variable-value injection), not just a formatting nicety.
const hslTripletSchema = z
  .string()
  .regex(/^\d{1,3} \d{1,3}% \d{1,3}%$/, 'Expected an HSL triplet like "217 70% 49%"');

export const customThemeSchema = z.object({
  primary: hslTripletSchema,
  primaryForeground: hslTripletSchema,
  secondary: hslTripletSchema,
  secondaryForeground: hslTripletSchema,
  accent: hslTripletSchema,
  accentForeground: hslTripletSchema,
  background: hslTripletSchema,
  foreground: hslTripletSchema,
  ring: hslTripletSchema,
});

// Either a preset id (legacy bare-string shape, decision 2) OR a Premium custom object.
export const themeSettingSchema = z.union([themeSchema, z.object({ custom: customThemeSchema })]);

const tenantSettingsSchema = z.object({
  theme: themeSettingSchema.optional(),
  printerConfig: printerConfigSchema.optional(),
  tickerText: z.string().max(500).optional(),
  businessName: z.string().max(100).optional(),
  videoMode: z.nativeEnum(VideoMode).optional(),
  liveStreamUrl: httpsUrlSchema.optional(),
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
  logoUrl: httpsUrlSchema.nullable().optional(),
  settings: tenantSettingsSchema.optional(),
});

export const updateTenantStatusSchema = z.object({
  tenantId: idSchema,
  status: z.nativeEnum(TenantStatus),
});

// Wave 7.8-T1 — Super Admin manual tier override (docs/PRODUCT.md "Tier management: toggle
// Free/Premium per tenant (manual override of Xendit state)").
export const setTenantTierSchema = z.object({
  tenantId: idSchema,
  tier: z.nativeEnum(TenantTier),
});

// ─── Service (Transaction Type) ──────────────────────────────────────────────

// Decision 4 — icon/color are constrained to the PM-authored option lists (packages/shared
// types/index.ts SERVICE_ICON_OPTIONS / SERVICE_COLOR_OPTIONS), not free-form emoji/hex.
const serviceIconOptions = SERVICE_ICON_OPTIONS as unknown as [string, ...string[]];
const serviceColorOptions = SERVICE_COLOR_OPTIONS as unknown as [string, ...string[]];

export const createServiceSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.enum(serviceIconOptions),
  color: z.enum(serviceColorOptions),
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
  ticketId: idSchema, // Ticket.id (cuid) — NOT the display `number` (e.g. "1-003"/"P-001")
  status: z.nativeEnum(TicketStatus),
  windowId: idSchema.nullable().optional(),
  servedBy: idSchema.nullable().optional(),
});

export const transferTicketSchema = z
  .object({
    ticketId: idSchema, // Ticket.id (cuid)
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
  ticketId: idSchema, // Ticket.id (cuid)
  // true = Priority Recall (auto-skips current). NOTE: Wave 7.1's queue domain only implements
  // "re-announce the current serving ticket" — the auto-skip variant is a station-level (7.4)
  // behavior layered on top of recall(), not yet wired.
  priority: z.boolean().default(false),
});

// Wave 7.1 — queueRouter-specific inputs.

export const callNextSchema = z.object({
  windowId: idSchema,
});

export const completeTicketSchema = z.object({
  ticketId: idSchema, // Ticket.id (cuid)
  outcome: z.enum(['done', 'noshow']),
});

export const skipTicketSchema = z.object({
  ticketId: idSchema, // Ticket.id (cuid)
});

// Wave 7.4 — "Skipped Tickets (tap to recall)" (PRODUCT.md line 32). Distinct from
// recallTicketSchema (which re-announces an ALREADY-serving ticket): this brings a `skipped`
// ticket back into `serving` at the calling employee's OWN window.
export const recallSkippedTicketSchema = z.object({
  ticketId: idSchema, // Ticket.id (cuid)
  windowId: idSchema, // Window.id (cuid) — the calling employee's currently-selected window
});

// Wave 7.4 — Employee Station per-user selected-window session (Valkey-backed, see
// apps/web/src/server/station/session.ts). Not persisted in Postgres — a lightweight UI-state
// pointer, hence its own tiny schema pair rather than reusing createWindowSchema/updateWindowSchema.
export const setStationWindowSchema = z.object({
  windowId: idSchema, // Window.id (cuid)
});

// ─── PlaylistEntry ───────────────────────────────────────────────────────────

export const createPlaylistEntrySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(MediaType.YouTube),
    title: z.string().min(1).max(200),
    videoId: youtubeVideoIdSchema,
    isLive: z.boolean().default(false),
  }),
  z.object({
    type: z.literal(MediaType.Local),
    title: z.string().min(1).max(200),
    storageKey: storageKeySchema,
    fileName: fileNameSchema,
    fileSize: z.number().int().positive(),
    fileExt: fileExtSchema,
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
    videoId: youtubeVideoIdSchema,
    duration: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal(AdType.Uploaded),
    title: z.string().min(1).max(200),
    storageKey: storageKeySchema,
    fileName: fileNameSchema,
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
    videoId: youtubeVideoIdSchema,
    duration: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal(AdType.Uploaded),
    title: z.string().min(1).max(200),
    storageKey: storageKeySchema,
    fileName: fileNameSchema,
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

// Security: xenditPlanId / xenditCustomerId must NOT come from the client.
// Flow: client POSTs this → server creates Xendit plan → returns redirect URL →
// Xendit sends webhook with IDs → server records them. Client sends no Xendit IDs.
export const upgradeSubscriptionSchema = z.object({});

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

// ─── Dashboard (Wave 7.7a) ─────────────────────────────────────────────────────

export const dashboardRangeSchema = z.object({
  range: z.enum(['daily', 'monthly', 'yearly']),
});

export const dashboardTicketLogSchema = z.object({
  range: z.enum(['daily', 'monthly', 'yearly']),
  search: z.string().max(200).optional(),
});

// ─── Inferred input types ─────────────────────────────────────────────────────

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;
export type UpdateTenantStatusInput = z.infer<typeof updateTenantStatusSchema>;
export type SetTenantTierInput = z.infer<typeof setTenantTierSchema>;

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
export type RecallSkippedTicketInput = z.infer<typeof recallSkippedTicketSchema>;
export type SetStationWindowInput = z.infer<typeof setStationWindowSchema>;

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

export type DashboardRangeInput = z.infer<typeof dashboardRangeSchema>;
export type DashboardTicketLogInput = z.infer<typeof dashboardTicketLogSchema>;
