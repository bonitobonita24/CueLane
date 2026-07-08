import type { Job } from 'bullmq';
import type { WebhooksJobPayload } from '@cuelane/jobs';
import { withTenant } from '@cuelane/db';

export async function processWebhooksJob(job: Job<WebhooksJobPayload>): Promise<void> {
  const { tenantId, endpoint, event, data, attempt } = job.data;

  await withTenant(tenantId, async (tx) => {
    // TODO (Phase 8): validate Xendit signature, dispatch to tenant handler, persist webhook log
    console.log(
      `[webhooks] processing event=${event} endpoint=${endpoint} attempt=${attempt ?? 1} tenant=${tenantId} job=${job.id ?? 'unknown'}`,
      { dataDefined: data !== undefined, txDefined: tx !== undefined },
    );
  });
}
