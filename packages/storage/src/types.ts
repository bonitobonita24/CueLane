/**
 * Allowed MIME types. Base set (image/pdf) from inputs.yml §File Uploads (10MB default cap,
 * avatars/logos/attachments). Video set widened per docs/PRODUCT.md §"Big Display Screen" /
 * §"File Uploads" (Wave 7.7c-T1) — MP4/AVI/MKV/WebM/MOV are the 5 web-compatible formats the
 * Media Manager playlist accepts (browser plays original via HTML5 `<video>`, no server-side
 * transcode — PRODUCT.md "Video processing: No server-side transcoding").
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
  'application/pdf',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

/**
 * Canonical MIME → extension map.
 * Extensions are derived from this map only — never from caller-supplied filenames.
 * (Finding #2: mime-extension-mismatch)
 */
export const MIME_TO_EXT: Readonly<Record<AllowedMimeType, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'application/pdf': '.pdf',
};

/** Explicitly blocked MIME types (security — XSS vectors) */
export const BLOCKED_MIME_TYPES = ['image/svg+xml', 'text/html', 'text/javascript', 'application/javascript'] as const;

/** Max file size in bytes (10MB from inputs.yml) — the DEFAULT cap used whenever a caller does
 *  not supply a tier-derived `maxBytes` override (e.g. logos/avatars/attachments). Big Display
 *  media uploads (Wave 7.7c) pass an explicit tier cap instead — see `MAX_UPLOAD_BYTES_BY_TIER`. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Tier-aware upload caps for Big Display media (docs/PRODUCT.md §"Media limits by tier":
 * "Free = 300MB per file. Premium = 800MB per file."). [HOW] decision (Wave 7.7c-T1: the byte
 * conversion 300*1024*1024 / 800*1024*1024 is recorded in docs/DECISIONS_LOG.md — PRODUCT.md
 * only states the MB figures).
 */
export const MAX_UPLOAD_BYTES_BY_TIER = {
  free: 300 * 1024 * 1024,
  premium: 800 * 1024 * 1024,
} as const;

export type UploadTier = keyof typeof MAX_UPLOAD_BYTES_BY_TIER;

/** Resolve the per-tier max upload size in bytes for the Media Manager upload path. */
export function getMaxUploadBytesForTier(tier: UploadTier): number {
  return MAX_UPLOAD_BYTES_BY_TIER[tier];
}

/**
 * Strict path-segment charset: lowercase alphanumeric, hyphens, underscores.
 * Used to validate tenantId and entityType before they are interpolated into storage keys.
 * (Finding #1: path-traversal-tenant-isolation-bypass)
 */
export const SEGMENT_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface UploadInput {
  /** Tenant ID for path scoping — must match SEGMENT_RE */
  tenantId: string;
  /** Entity type (e.g. 'avatars', 'ads', 'attachments') — must match SEGMENT_RE */
  entityType: string;
  /** File contents as Buffer or Uint8Array */
  body: Buffer | Uint8Array;
  /** MIME type — must be in ALLOWED_MIME_TYPES */
  mimeType: string;
  /**
   * Original filename — NOT used for extension; included only for audit/logging.
   * Extension is derived from mimeType via MIME_TO_EXT.
   */
  originalFilename: string;
  /** File size in bytes — validated against MAX_FILE_SIZE_BYTES */
  sizeBytes: number;
  /**
   * Optional per-call size cap override in bytes (e.g. `getMaxUploadBytesForTier(tenant.tier)`
   * for Media Manager uploads). Defaults to `MAX_FILE_SIZE_BYTES` (10MB) when omitted, preserving
   * the existing avatar/attachment upload behavior unchanged.
   */
  maxBytes?: number;
}

export interface UploadResult {
  /** Storage key (path in bucket) */
  key: string;
  /** Public or pre-signed URL (depending on bucket policy) */
  url: string;
  /** ETag from the storage provider */
  etag: string | undefined;
}

export interface GetSignedUrlInput {
  /** Tenant ID — asserted against key prefix before issuing S3 call */
  tenantId: string;
  key: string;
  /** Expiry in seconds (default: 3600 = 1 hour) */
  expiresIn?: number;
}

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageValidationError';
  }
}

/** Thrown when a key does not belong to the asserted tenant (Finding #3) */
export class StorageAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageAuthorizationError';
  }
}
