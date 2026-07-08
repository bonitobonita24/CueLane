import type { Job } from 'bullmq';
import type { ReportsJobPayload } from '@cuelane/jobs';
import { withTenant } from '@cuelane/db';

export async function processReportsJob(job: Job<ReportsJobPayload>): Promise<void> {
  const { tenantId, reportType, filters, outputFormat, notifyEmail } = job.data;

  await withTenant(tenantId, async (tx) => {
    // TODO (Phase 8): query tenant data via tx, build report, upload to storage
    console.log(
      `[reports] generating reportType=${reportType} format=${outputFormat} tenant=${tenantId} job=${job.id ?? 'unknown'}`,
      { filters, notifyEmail, txDefined: tx !== undefined },
    );
  });
}
