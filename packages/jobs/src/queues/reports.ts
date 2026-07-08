import { Queue } from 'bullmq';
import { getConnectionOptions } from '../connection';
import type { ReportsJobPayload } from '../types';

export const REPORTS_QUEUE_NAME = 'reports' as const;

export const reportsQueue = new Queue<ReportsJobPayload>(REPORTS_QUEUE_NAME, {
  connection: getConnectionOptions(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  },
});

export const reportsDlq = new Queue<ReportsJobPayload>(`${REPORTS_QUEUE_NAME}:dlq`, {
  connection: getConnectionOptions(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

export async function addReportsJob(payload: ReportsJobPayload, options?: { delay?: number; priority?: number }) {
  return reportsQueue.add('generate', payload, options);
}
