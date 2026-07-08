import { S3Client } from '@aws-sdk/client-s3';

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

function getStorageConfig(): StorageConfig {
  return {
    endpoint: process.env['MINIO_ENDPOINT'] ?? 'http://localhost:41709',
    region: process.env['MINIO_REGION'] ?? 'us-east-1',
    accessKeyId: process.env['MINIO_ACCESS_KEY'] ?? 'minioadmin',
    secretAccessKey: process.env['MINIO_SECRET_KEY'] ?? 'minioadmin',
    bucket: process.env['MINIO_BUCKET'] ?? 'cuelane-dev',
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
  return process.env['MINIO_BUCKET'] ?? 'cuelane-dev';
}
