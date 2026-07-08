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
