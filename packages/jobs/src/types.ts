/** Base fields required on every job payload (tenant-scoped per inputs.yml) */
export interface BaseTenantPayload {
  tenantId: string;
  userId: string;
}

/** Email queue job payload */
export interface EmailJobPayload extends BaseTenantPayload {
  to: string;
  subject: string;
  templateId: string;
  templateData: Record<string, unknown>;
}

/** Reports queue job payload */
export interface ReportsJobPayload extends BaseTenantPayload {
  reportType: string;
  filters: Record<string, unknown>;
  outputFormat: 'csv' | 'pdf' | 'xlsx';
  notifyEmail?: string;
}

/** Webhooks queue job payload */
export interface WebhooksJobPayload extends BaseTenantPayload {
  endpoint: string;
  event: string;
  data: Record<string, unknown>;
  attempt?: number;
}

/** DLQ payload wraps the failed job's original payload */
export interface DlqPayload<T = unknown> {
  originalPayload: T;
  failedAt: string;
  reason: string;
}
