// Wave 7.7c-T1 — @cuelane/storage tier-aware upload limits + widened mime allowlist (TDD).
// putObject() runs validateUpload() BEFORE any S3 call, so oversized/blocked/disallowed inputs
// throw synchronously without touching MinIO. The one "accepted" happy-path test performs a real
// round-trip against the dev MinIO instance (no mocks, per framework convention) — requires the
// dev stack's MinIO reachable at MINIO_ENDPOINT (defaults to http://localhost:41709 in non-prod).
import { describe, expect, it } from 'vitest';
import {
  putObject,
  deleteObject,
  StorageValidationError,
  MAX_FILE_SIZE_BYTES,
  MAX_UPLOAD_BYTES_BY_TIER,
  getMaxUploadBytesForTier,
} from './index.js';

const TENANT = 'test-media-tenant';

describe('getMaxUploadBytesForTier (Wave 7.7c-T1)', () => {
  it('returns the free-tier 300MB cap', () => {
    expect(getMaxUploadBytesForTier('free')).toBe(300 * 1024 * 1024);
    expect(MAX_UPLOAD_BYTES_BY_TIER.free).toBe(300 * 1024 * 1024);
  });

  it('returns the premium-tier 800MB cap', () => {
    expect(getMaxUploadBytesForTier('premium')).toBe(800 * 1024 * 1024);
    expect(MAX_UPLOAD_BYTES_BY_TIER.premium).toBe(800 * 1024 * 1024);
  });
});

describe('putObject — tier-aware size cap (Wave 7.7c-T1)', () => {
  it('rejects a body over the free-tier cap even though it is under the legacy 10MB-default check', async () => {
    // Body itself is small (well under 10MB) but we pass a tiny maxBytes override to prove the
    // cap — not MAX_FILE_SIZE_BYTES — governs when present. Simulates a >300MB upload cheaply.
    const body = Buffer.alloc(1024, 1);
    await expect(
      putObject({
        tenantId: TENANT,
        entityType: 'media',
        body,
        mimeType: 'video/mp4',
        originalFilename: 'clip.mp4',
        sizeBytes: body.byteLength,
        maxBytes: 512, // simulate an over-cap upload
      }),
    ).rejects.toBeInstanceOf(StorageValidationError);
  });

  it('accepts a body at exactly the boundary (maxBytes) and rejects one byte over', async () => {
    const atBoundary = Buffer.alloc(1000, 1);
    // At the exact boundary → validation passes (goes on to hit S3; real MinIO round-trip).
    const result = await putObject({
      tenantId: TENANT,
      entityType: 'media',
      body: atBoundary,
      mimeType: 'video/mp4',
      originalFilename: 'clip.mp4',
      sizeBytes: atBoundary.byteLength,
      maxBytes: 1000,
    });
    expect(result.key).toMatch(new RegExp(`^${TENANT}/media/.+\\.mp4$`));
    await deleteObject(TENANT, result.key);

    const overBoundary = Buffer.alloc(1001, 1);
    await expect(
      putObject({
        tenantId: TENANT,
        entityType: 'media',
        body: overBoundary,
        mimeType: 'video/mp4',
        originalFilename: 'clip.mp4',
        sizeBytes: overBoundary.byteLength,
        maxBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(StorageValidationError);
  });

  it('without a maxBytes override, falls back to the legacy MAX_FILE_SIZE_BYTES (10MB) default', async () => {
    const oversizedForDefault = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 1);
    await expect(
      putObject({
        tenantId: TENANT,
        entityType: 'avatars',
        body: oversizedForDefault,
        mimeType: 'image/png',
        originalFilename: 'avatar.png',
        sizeBytes: oversizedForDefault.byteLength,
      }),
    ).rejects.toBeInstanceOf(StorageValidationError);
  });
});

describe('putObject — widened video mime allowlist (Wave 7.7c-T1)', () => {
  it.each(['video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'])(
    'accepts %s and round-trips a real object against dev MinIO',
    async (mimeType) => {
      const body = Buffer.from('fake-video-bytes');
      const result = await putObject({
        tenantId: TENANT,
        entityType: 'media',
        body,
        mimeType,
        originalFilename: 'clip',
        sizeBytes: body.byteLength,
      });
      expect(result.key).toMatch(new RegExp(`^${TENANT}/media/`));
      await deleteObject(TENANT, result.key);
    },
  );

  it('still blocks a disallowed mime type (e.g. text/plain)', async () => {
    const body = Buffer.from('hello');
    await expect(
      putObject({
        tenantId: TENANT,
        entityType: 'media',
        body,
        mimeType: 'text/plain',
        originalFilename: 'note.txt',
        sizeBytes: body.byteLength,
      }),
    ).rejects.toBeInstanceOf(StorageValidationError);
  });

  it('still blocks explicitly blocked mime types (e.g. image/svg+xml — XSS vector)', async () => {
    const body = Buffer.from('<svg onload=alert(1)>');
    await expect(
      putObject({
        tenantId: TENANT,
        entityType: 'media',
        body,
        mimeType: 'image/svg+xml',
        originalFilename: 'evil.svg',
        sizeBytes: body.byteLength,
      }),
    ).rejects.toBeInstanceOf(StorageValidationError);
  });
});
