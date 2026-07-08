import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { getS3Client, getDefaultBucket } from './config.js';
import {
  ALLOWED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  StorageValidationError,
  type UploadInput,
  type UploadResult,
  type GetSignedUrlInput,
} from './types.js';

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

  // Size check
  if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (input.sizeBytes / 1024 / 1024).toFixed(2);
    throw new StorageValidationError(`File size ${sizeMb}MB exceeds the 10MB limit`);
  }
}

function buildStorageKey(input: Pick<UploadInput, 'tenantId' | 'entityType' | 'originalFilename'>): string {
  const ext = extname(input.originalFilename).toLowerCase();
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

export async function getObject(key: string, bucket?: string): Promise<Uint8Array> {
  const client = getS3Client();
  const bucketName = bucket ?? getDefaultBucket();

  const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`Object not found: ${key}`);
  }

  return response.Body.transformToByteArray();
}

export async function deleteObject(key: string, bucket?: string): Promise<void> {
  const client = getS3Client();
  const bucketName = bucket ?? getDefaultBucket();

  const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
  await client.send(command);
}

export async function getSignedDownloadUrl(input: GetSignedUrlInput, bucket?: string): Promise<string> {
  const client = getS3Client();
  const bucketName = bucket ?? getDefaultBucket();
  const expiresIn = input.expiresIn ?? 3600;

  const command = new GetObjectCommand({ Bucket: bucketName, Key: input.key });
  return getSignedUrl(client, command, { expiresIn });
}
