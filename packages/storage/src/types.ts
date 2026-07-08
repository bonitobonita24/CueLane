/** Allowed MIME types per inputs.yml */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
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
  'application/pdf': '.pdf',
};

/** Explicitly blocked MIME types (security — XSS vectors) */
export const BLOCKED_MIME_TYPES = ['image/svg+xml', 'text/html', 'text/javascript', 'application/javascript'] as const;

/** Max file size in bytes (10MB from inputs.yml) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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
