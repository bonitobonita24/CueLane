import { Queue } from 'bullmq';
import { getConnectionOptions } from '../connection';
import type { WebhooksJobPayload } from '../types';

export const WEBHOOKS_QUEUE_NAME = 'webhooks' as const;

export const webhooksQueue = new Queue<WebhooksJobPayload>(WEBHOOKS_QUEUE_NAME, {
  connection: getConnectionOptions(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  },
});

export const webhooksDlq = new Queue<WebhooksJobPayload>(`${WEBHOOKS_QUEUE_NAME}:dlq`, {
  connection: getConnectionOptions(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

export async function addWebhookJob(payload: WebhooksJobPayload, options?: { delay?: number; priority?: number }) {
  return webhooksQueue.add('dispatch', payload, options);
}
