// ─── Enums ───────────────────────────────────────────────────────────────────

export enum Role {
  Employee = 'employee',
  Admin = 'admin',
  SuperAdmin = 'super_admin',
}

export enum TenantTier {
  Free = 'free',
  Premium = 'premium',
}

export enum TenantStatus {
  Active = 'active',
  Suspended = 'suspended',
}

export enum VideoMode {
  Playlist = 'playlist',
  Live = 'live',
}

export enum TicketStatus {
  Waiting = 'waiting',
  Serving = 'serving',
  Completed = 'completed',
  Skipped = 'skipped',
  NoShow = 'noshow',
}

export enum PaymentStatus {
  Active = 'active',
  PastDue = 'past_due',
  Cancelled = 'cancelled',
  Free = 'free',
}

export enum MediaType {
  YouTube = 'youtube',
  Local = 'local',
}

export enum AdType {
  YouTube = 'youtube',
  Uploaded = 'uploaded',
}

// ─── Wave 7.6 — Admin Core CRUD constants ─────────────────────────────────────
// PM-locked decisions (docs/DECISIONS_LOG.md 2026-07-08 "Wave 7.6 Admin Core CRUD"). Tier limits
// (decision 1), theme presets (decision 2), service icon/color allowlists (decision 4).

/** Per-tenant free-tier caps. `null` = unlimited (premium). Block-AT-cap semantics: a create is
 *  rejected once `existingCount >= limit` — see apps/web/src/server/domain/admin.ts. */
export const TIER_LIMITS = {
  free: { users: 10, services: 6, windows: 4 },
  premium: null,
} as const;

/** The 9 CSS custom-property vars every theme (preset OR custom) resolves to. Values are bare
 *  HSL triplet strings ("H S% L%", NO `hsl()` wrapper) — the exact format `packages/ui`'s
 *  Tailwind config expects (`hsl(var(--primary))` etc.) and `globals.css` already uses for the
 *  base `:root`/`.dark` tokens. Chosen to match the vars Kiosk/Station/Admin actually consume
 *  (`bg-primary`, `border-primary`, `text-primary-foreground`, `ring-ring`, `bg-secondary`,
 *  `bg-accent`, `bg-background`, `text-foreground`, etc. — grepped across apps/web + packages/ui). */
export interface ThemeVars {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  ring: string;
}

/** Premium-only custom 9-color theme (Wave 7.7b) — same 9 keys as `ThemeVars`, tenant-supplied. */
export type CustomTheme = ThemeVars;

/** 8 preset theme ids (decision 2, Wave 7.6) — each now carries real CSS-variable color VALUES
 *  (Wave 7.7b), not just an id/label. Every preset is WCAG-AA contrast-checked (primary vs. its
 *  white foreground, ≥4.5:1) and tasteful/distinct — no default-indigo-slop; 'indigo' is one of 8
 *  explicit user-selectable options here, not the app's own default accent (that's Link Blue,
 *  globals.css `:root`). `secondary`/`accent`/`background`/`foreground` are left at the base
 *  neutral `:root` values for every preset (only the accent hue changes per-tenant) — only
 *  `primary`/`primaryForeground`/`ring` vary. */
export const THEME_PRESETS = [
  {
    id: 'indigo', label: 'Indigo',
    vars: { primary: '243 75% 59%', primaryForeground: '0 0% 100%', ring: '243 75% 59%' },
  },
  {
    id: 'ocean', label: 'Ocean',
    vars: { primary: '201 96% 32%', primaryForeground: '0 0% 100%', ring: '201 96% 32%' },
  },
  {
    id: 'emerald', label: 'Emerald',
    vars: { primary: '163 94% 24%', primaryForeground: '0 0% 100%', ring: '163 94% 24%' },
  },
  {
    id: 'rose', label: 'Rose',
    vars: { primary: '345 83% 41%', primaryForeground: '0 0% 100%', ring: '345 83% 41%' },
  },
  {
    id: 'amber', label: 'Amber',
    vars: { primary: '26 90% 37%', primaryForeground: '0 0% 100%', ring: '26 90% 37%' },
  },
  {
    id: 'violet', label: 'Violet',
    vars: { primary: '263 70% 50%', primaryForeground: '0 0% 100%', ring: '263 70% 50%' },
  },
  {
    id: 'teal', label: 'Teal',
    vars: { primary: '175 77% 26%', primaryForeground: '0 0% 100%', ring: '175 77% 26%' },
  },
  {
    id: 'slate', label: 'Slate',
    vars: { primary: '215 25% 27%', primaryForeground: '0 0% 100%', ring: '215 25% 27%' },
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  vars: Pick<ThemeVars, 'primary' | 'primaryForeground' | 'ring'>;
}>;

export type ThemePresetId = (typeof THEME_PRESETS)[number]['id'];

/** Neutral base vars (from globals.css `:root`) every preset inherits for the 6 vars it doesn't
 *  override. Kept here (not re-derived) so `resolveThemeVars` never has to reach into CSS. */
export const THEME_BASE_VARS: Omit<ThemeVars, 'primary' | 'primaryForeground' | 'ring'> = {
  secondary: '210 8% 95%',
  secondaryForeground: '228 8% 25%',
  accent: '210 8% 95%',
  accentForeground: '228 8% 25%',
  background: '0 0% 100%',
  foreground: '0 0% 0%',
};

/** A tenant's `settings.theme` value: a preset id (legacy bare-string shape, Wave 7.6) OR a
 *  Premium custom 9-color object (Wave 7.7b). */
export type ThemeSetting = ThemePresetId | { custom: CustomTheme };

/** 16 emoji options for Service.icon (decision 4). */
export const SERVICE_ICON_OPTIONS = [
  '💰', '📋', '📂', '💳', '🏦', '📄', '✍️', '🔑',
  '📦', '🛠️', '💼', '🧾', '🪪', '📑', '🏧', '👥',
] as const;

/** 12 hex color options for Service.color — a superset including every seed color
 *  (#3B82F6 Cash Deposit, #10B981 Loan Inquiry, #8B5CF6 Account Opening, #F59E0B Withdrawal). */
export const SERVICE_COLOR_OPTIONS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#64748B', // slate
] as const;

// ─── Tenant Settings ─────────────────────────────────────────────────────────

export interface PrinterConfig {
  enabled?: boolean;
  paperWidth?: string;
  marginTop?: number;
  marginBottom?: number;
  autoCut?: boolean;
  footerText?: string;
}

export interface TenantSettings {
  /** A THEME_PRESETS id (e.g. 'indigo', decision 2) OR a Premium custom-color object
   *  (`{ custom: {...} }`, Wave 7.7b). See `ThemeSetting`. */
  theme?: ThemeSetting;
  printerConfig?: PrinterConfig;
  tickerText?: string;
  businessName?: string;
  videoMode?: VideoMode;
  liveStreamUrl?: string;
}

// ─── Entities ────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  companyName: string;
  tagline: string;
  logoUrl: string | null;
  tier: TenantTier;
  createdAt: Date;
  status: TenantStatus;
  settings: TenantSettings;
}

export interface Service {
  id: string;
  tenantId: string;
  number: number;  // per-tenant ordinal — regular-ticket prefix, e.g. the "1" in "1-003"
  name: string;
  icon: string;    // emoji from 16 options
  color: string;   // hex from 12 options
  avgTime: number; // minutes
}

export interface Window {
  id: string;
  tenantId: string;
  name: string;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  role: Role;
  pin: string;          // 4–6 digits
  services: string[];   // serviceIds the employee can handle
}

export interface Ticket {
  id: string;            // cuid primary key
  tenantId: string;
  serviceId: string;
  number: string;        // P-NNN (priority) or {serviceNumber}-NNN (regular) — persisted display number
  sequence: number;       // numeric part of `number`, e.g. 3 for "1-003"
  status: TicketStatus;
  windowId: string | null;
  createdAt: Date;
  calledAt: Date | null;
  completedAt: Date | null;
  servedBy: string | null;         // userId
  priority: boolean;
  transferred: boolean;
  transferredFrom: string | null;  // windowId
  returnTo: string | null;         // windowId — set during transfer with Return After Done
  returnedFromTransfer: boolean;
}

export interface PlaylistEntry {
  id: string;
  tenantId: string;
  type: MediaType;
  title: string;
  videoId: string | null;      // YouTube video ID
  storageKey: string | null;   // local upload key
  fileName: string | null;
  fileSize: number | null;     // bytes
  fileExt: string | null;
  isLive: boolean | null;      // true = YouTube Live stream
  sortOrder: number;
}

/** Per-tenant ads — Premium only, LIVE mode only */
export interface TenantAd {
  id: string;
  tenantId: string;
  type: AdType;
  title: string;
  videoId: string | null;
  storageKey: string | null;
  fileName: string | null;
  fileSize: number | null;   // bytes
  duration: number | null;   // seconds (admin estimate; YT resolved via iframe API)
  sortOrder: number;
  createdAt: Date;
}

/** Global system ads — managed by Super Admin, shown to Free-tier tenants every 5 min */
export interface SystemAd {
  id: string;
  type: AdType;
  title: string;
  videoId: string | null;
  storageKey: string | null;
  fileName: string | null;
  fileSize: number | null;   // bytes
  duration: number | null;   // seconds
  sortOrder: number;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  tenantId: string;
  tier: TenantTier;
  startDate: Date;
  endDate: Date | null;
  downgradeAt: Date | null;        // set on cancellation; system reverts tier on this date
  paymentStatus: PaymentStatus;
  xenditPlanId: string | null;
  xenditCustomerId: string | null;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;        // bcrypt-hashed
  expiresAt: Date;
  usedAt: Date | null;
}

// ─── Valkey Session Map (in-memory only — NOT a DB entity) ───────────────────

/**
 * Cached session data stored in Valkey per authenticated user.
 * Employee PIN sessions: stateless — verified per-request, no persistent cookie.
 * Admin sessions: JWT-backed. This type represents the Valkey cache shape only.
 */
export interface SessionMapEntry {
  userId: string;
  tenantId: string;
  role: Role;
  windowId: string | null;  // current window for employees; null otherwise
  expiresAt: number;         // unix timestamp (ms)
}
