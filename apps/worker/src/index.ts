import { Worker } from 'bullmq';
import {
  EMAIL_QUEUE_NAME,
  REPORTS_QUEUE_NAME,
  WEBHOOKS_QUEUE_NAME,
  getConnectionOptions,
  type EmailJobPayload,
  type ReportsJobPayload,
  type WebhooksJobPayload,
} from '@cuelane/jobs';
import { processEmailJob } from './processors/email.processor.js';
import { processReportsJob } from './processors/reports.processor.js';
import { processWebhooksJob } from './processors/webhooks.processor.js';
import './env.js'; // validates env at startup

const connection = getConnectionOptions();

const emailWorker = new Worker<EmailJobPayload>(
  EMAIL_QUEUE_NAME,
  (job) => processEmailJob(job),
  { connection, concurrency: 5 },
);

const reportsWorker = new Worker<ReportsJobPayload>(
  REPORTS_QUEUE_NAME,
  (job) => processReportsJob(job),
  { connection, concurrency: 2 },
);

const webhooksWorker = new Worker<WebhooksJobPayload>(
  WEBHOOKS_QUEUE_NAME,
  (job) => processWebhooksJob(job),
  { connection, concurrency: 10 },
);

const workers = [emailWorker, reportsWorker, webhooksWorker];

for (const worker of workers) {
  worker.on('completed', (job) => {
    console.log(`[${worker.name}] job=${job.id ?? 'unknown'} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[${worker.name}] job=${job?.id ?? 'unknown'} failed:`, err);
  });
}

console.log(`[worker] started — queues: ${EMAIL_QUEUE_NAME}, ${REPORTS_QUEUE_NAME}, ${WEBHOOKS_QUEUE_NAME}`);
console.log(`[worker] port=41717 (health only — no HTTP server; BullMQ manages Redis connections)`);

// TODO S7: add Dockerfile for containerised deployment

let shutdownInProgress = false;
async function shutdown(): Promise<void> {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  console.log('[worker] shutting down…');
  try {
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  } catch (err) {
    console.error('[worker] error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
