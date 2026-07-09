import { S3Client } from '@aws-sdk/client-s3';

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

/**
 * Require an env var in production; fall back to a dev default only when
 * NODE_ENV !== 'production'. Throws at client-init time so misconfigured
 * deployments fail fast rather than silently using dev credentials.
 * (Finding #4: insecure-default-credentials-fail-open)
 */
function requireEnv(key: string, devDefault: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== '') return value;
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      `[storage] Required environment variable '${key}' is not set. ` +
      `Production deployments must supply explicit storage credentials.`
    );
  }
  return devDefault;
}

function getStorageConfig(): StorageConfig {
  return {
    endpoint:        requireEnv('MINIO_ENDPOINT',   'http://localhost:41709'),
    region:          requireEnv('MINIO_REGION',     'us-east-1'),
    accessKeyId:     requireEnv('MINIO_ACCESS_KEY', 'minioadmin'),
    secretAccessKey: requireEnv('MINIO_SECRET_KEY', 'minioadmin'),
    bucket:          requireEnv('MINIO_BUCKET',     'cuelane-dev'),
    forcePathStyle: true, // Required for MinIO
  };
}

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!_client) {
    const cfg = getStorageConfig();
    _client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: cfg.forcePathStyle,
    });
  }
  return _client;
}

export function getDefaultBucket(): string {
  return requireEnv('MINIO_BUCKET', 'cuelane-dev');
}

/**
 * Wave 7.7d — the BROWSER-reachable storage origin, used ONLY when presigning a download URL
 * that a public client (the Big Display's `<video>`/iframe tags) will fetch directly. This is
 * deliberately a SEPARATE endpoint from `getS3Client()` above: in every non-dev environment
 * `MINIO_ENDPOINT` is the container-network hostname (e.g. `http://minio:9000` in staging/prod
 * compose — see `.env.staging.example`/`.env.prod.example`), which a browser can never resolve.
 * `MINIO_PUBLIC_ENDPOINT` is the externally-reachable origin (dev: `http://localhost:41709` —
 * the host-mapped MinIO port; staging/prod: the public S3/R2/CDN origin fronting the bucket).
 * Falls back to `MINIO_ENDPOINT` with a one-time console warning if unset, so a misconfigured
 * deploy degrades to a broken (but same-signature) video panel rather than silently mismatching.
 */
let _warnedMissingPublicEndpoint = false;
export function getPublicEndpoint(): string {
  const explicit = process.env['MINIO_PUBLIC_ENDPOINT'];
  if (explicit !== undefined && explicit !== '') return explicit;
  if (!_warnedMissingPublicEndpoint) {
    _warnedMissingPublicEndpoint = true;
    // eslint-disable-next-line no-console -- operator-facing config warning, not app telemetry
    console.warn(
      '[storage] MINIO_PUBLIC_ENDPOINT is not set — falling back to MINIO_ENDPOINT for signed ' +
      'URLs. Fine in dev (both point at localhost) but produces a browser-unreachable URL in ' +
      'staging/prod if MINIO_ENDPOINT is the internal container hostname.',
    );
  }
  return requireEnv('MINIO_ENDPOINT', 'http://localhost:41709');
}

let _publicClient: S3Client | null = null;

/** A second S3Client identical to `getS3Client()` except its `endpoint` is the public origin —
 *  used ONLY to presign URLs (never to actually PUT/GET/DELETE server-side; those always go
 *  through the internal `getS3Client()` so server-to-MinIO traffic stays on the container
 *  network). Presigned-URL signatures are endpoint-relative, so a URL signed against the wrong
 *  origin fails signature verification at the browser — this second client must exist. */
export function getPublicS3Client(): S3Client {
  if (!_publicClient) {
    const cfg = getStorageConfig();
    _publicClient = new S3Client({
      endpoint: getPublicEndpoint(),
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: cfg.forcePathStyle,
    });
  }
  return _publicClient;
}
