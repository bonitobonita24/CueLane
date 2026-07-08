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

// ─── Tenant Settings ─────────────────────────────────────────────────────────

export interface PrinterConfig {
  paperWidth?: string;
  marginTop?: number;
  marginBottom?: number;
  autoCut?: boolean;
  footerText?: string;
}

export interface TenantSettings {
  theme?: string;
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
  id: string;           // P-NNN (priority) or {serviceNumber}-NNN (regular)
  tenantId: string;
  serviceId: string;
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
