import { Queue } from 'bullmq';
import { getConnectionOptions } from '../connection.js';
import type { EmailJobPayload } from '../types.js';

export const EMAIL_QUEUE_NAME = 'email' as const;

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: getConnectionOptions(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: false, // Keep failed jobs for DLQ inspection
  },
});

/** Dead-letter queue for email jobs that exhausted all retries */
export const emailDlq = new Queue<EmailJobPayload>(`${EMAIL_QUEUE_NAME}-dlq`, {
  connection: getConnectionOptions(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

export async function addEmailJob(payload: EmailJobPayload, options?: { delay?: number; priority?: number }) {
  return emailQueue.add('send', payload, options);
}
