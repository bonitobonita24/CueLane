import type { RedisOptions } from 'bullmq';

/**
 * Returns BullMQ-compatible Redis connection options parsed from VALKEY_URL.
 * Passing raw options (not a Redis instance) avoids dual-ioredis-version type
 * conflicts and lets BullMQ manage its own connection lifecycle per queue.
 */
export function getConnectionOptions(): RedisOptions {
  const url = process.env['VALKEY_URL'] ?? 'redis://localhost:41708';
  const parsed = new URL(url);
  const options: RedisOptions = {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  };
  if (parsed.password) {
    options.password = parsed.password;
  }
  if (parsed.protocol === 'rediss:') {
    options.tls = {};
  }
  return options;
}

/**
 * No-op kept for API compatibility — BullMQ closes its own connections when
 * queue.close() is called on each queue. Call queue.close() directly to shut
 * down individual queues.
 */
export async function closeConnection(): Promise<void> {
  // BullMQ manages per-queue connections; close via emailQueue.close() etc.
}
