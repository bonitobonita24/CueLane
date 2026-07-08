import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { getS3Client, getDefaultBucket } from './config.js';
import {
  ALLOWED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MIME_TO_EXT,
  SEGMENT_RE,
  StorageAuthorizationError,
  StorageValidationError,
  type AllowedMimeType,
  type UploadInput,
  type UploadResult,
  type GetSignedUrlInput,
} from './types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Assert that a path segment (tenantId / entityType) contains only safe characters.
 * Rejects empty strings, path traversal sequences, slashes, and control characters.
 * (Finding #1: path-traversal-tenant-isolation-bypass)
 */
function validatePathSegment(value: string, label: string): void {
  if (!value || !SEGMENT_RE.test(value)) {
    throw new StorageValidationError(
      `Invalid ${label} '${value}': must match /^[a-z0-9][a-z0-9_-]{0,63}$/ and must not be empty`
    );
  }
}

/**
 * Assert that a storage key is scoped to the given tenant.
 * Prevents cross-tenant reads/deletes on the accessor functions.
 * (Finding #3: missing-tenant-authorization-on-key-accessors)
 */
function assertTenantKey(tenantId: string, key: string): void {
  validatePathSegment(tenantId, 'tenantId');
  if (!key.startsWith(`${tenantId}/`)) {
    throw new StorageAuthorizationError(
      `Key '${key}' does not belong to tenant '${tenantId}'`
    );
  }
}

// ── upload ────────────────────────────────────────────────────────────────────

function validateUpload(input: UploadInput): void {
  // Block explicitly dangerous types first
  if ((BLOCKED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new StorageValidationError(`MIME type '${input.mimeType}' is blocked for security reasons`);
  }

  // Enforce allowlist
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new StorageValidationError(
      `MIME type '${input.mimeType}' is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    );
  }

  // Validate path segments — must not contain traversal characters (Finding #1)
  validatePathSegment(input.tenantId, 'tenantId');
  validatePathSegment(input.entityType, 'entityType');

  // Size check
  if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (input.sizeBytes / 1024 / 1024).toFixed(2);
    throw new StorageValidationError(`File size ${sizeMb}MB exceeds the 10MB limit`);
  }
}

function buildStorageKey(input: Pick<UploadInput, 'tenantId' | 'entityType' | 'mimeType'>): string {
  // Derive extension from the VALIDATED mime type — never from originalFilename.
  // (Finding #2: mime-extension-mismatch)
  const ext = MIME_TO_EXT[input.mimeType as AllowedMimeType];
  const randomFilename = `${randomUUID()}${ext}`;
  // Path pattern: {tenantId}/{entityType}/{randomFilename}
  return `${input.tenantId}/${input.entityType}/${randomFilename}`;
}

export async function putObject(input: UploadInput, bucket?: string): Promise<UploadResult> {
  validateUpload(input);

  const client = getS3Client();
  const bucketName = bucket ?? getDefaultBucket();
  const key = buildStorageKey(input);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: input.body,
    ContentType: input.mimeType,
    ContentLength: input.sizeBytes,
  });

  const response = await client.send(command);

  return {
    key,
    url: `${process.env['MINIO_ENDPOINT'] ?? 'http://localhost:41709'}/${bucketName}/${key}`,
    etag: response.ETag,
  };
}

// ── accessors ─────────────────────────────────────────────────────────────────

/**
 * Download an object. `tenantId` is asserted against the key prefix to prevent
 * cross-tenant access. (Finding #3)
 */
export async function getObject(tenantId: string, key: string, bucket?: string): Promise<Uint8Array> {
  assertTenantKey(tenantId, key);

  const client = getS3Client();
  const bucketName = bucket ?? getDefaultBucket();

  const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`Object not found: ${key}`);
  }

  return response.Body.transformToByteArray();
}

/**
 * Delete an object. `tenantId` is asserted against the key prefix to prevent
 * cross-tenant deletion. (Finding #3)
 */
export async function deleteObject(tenantId: string, key: string, bucket?: string): Promise<void> {
  assertTenantKey(tenantId, key);

  const client = getS3Client();
  const bucketName = bucket ?? getDefaultBucket();

  const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
  await client.send(command);
}

/**
 * Generate a pre-signed download URL. `tenantId` in the input is asserted against
 * the key prefix to prevent cross-tenant URL generation. (Finding #3)
 */
export async function getSignedDownloadUrl(input: GetSignedUrlInput, bucket?: string): Promise<string> {
  assertTenantKey(input.tenantId, input.key);

  const client = getS3Client();
  const bucketName = bucket ?? getDefaultBucket();
  const expiresIn = input.expiresIn ?? 3600;

  const command = new GetObjectCommand({ Bucket: bucketName, Key: input.key });
  return getSignedUrl(client, command, { expiresIn });
}
