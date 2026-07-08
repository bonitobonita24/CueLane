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

/** Explicitly blocked MIME types (security — XSS vectors) */
export const BLOCKED_MIME_TYPES = ['image/svg+xml', 'text/html', 'text/javascript', 'application/javascript'] as const;

/** Max file size in bytes (10MB from inputs.yml) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface UploadInput {
  /** Tenant ID for path scoping */
  tenantId: string;
  /** Entity type (e.g. 'avatars', 'ads', 'attachments') */
  entityType: string;
  /** File contents as Buffer or Uint8Array */
  body: Buffer | Uint8Array;
  /** MIME type — must be in ALLOWED_MIME_TYPES */
  mimeType: string;
  /** Original filename (used for extension extraction only; NOT stored in path) */
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
