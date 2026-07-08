import type { Job } from 'bullmq';
import nodemailer from 'nodemailer';
import type { EmailJobPayload } from '@cuelane/jobs';
import { env } from '../env.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  ...(env.SMTP_USER !== undefined && env.SMTP_PASS !== undefined
    ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
    : {}),
});

/** Escape HTML special characters to prevent injection in email templates. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safely coerce an unknown template value to a string. Only primitives are
 * stringified; objects/arrays/functions become '' (never leak '[object Object]'
 * into an email, and satisfies @typescript-eslint/no-base-to-string).
 */
function asStr(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : '';
}

function renderTemplate(
  templateId: string,
  data: Record<string, unknown>,
): { subject: string; html: string; text: string } {
  const rawUrl = asStr(data['url']);
  const url = escapeHtml(rawUrl);
  const plan = escapeHtml(asStr(data['plan']));
  const endDate = escapeHtml(asStr(data['endDate']));
  const renewalDate = escapeHtml(asStr(data['renewalDate']));

  switch (templateId) {
    case 'email_verification':
      return {
        subject: 'Verify your CueLane account',
        html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
        text: `Verify your email: ${rawUrl}`,
      };
    case 'password_reset':
      return {
        subject: 'Reset your CueLane password',
        html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1 hour.</p>`,
        text: `Reset your password: ${rawUrl}`,
      };
    case 'subscription_confirmation':
      return {
        subject: 'Your CueLane subscription is confirmed',
        html: `<p>Your subscription to plan <strong>${plan}</strong> is now active.</p>`,
        text: `Your subscription to ${asStr(data['plan'])} is now active.`,
      };
    case 'subscription_cancellation':
      return {
        subject: 'Your CueLane subscription has been cancelled',
        html: `<p>Your subscription has been cancelled. Access ends on ${endDate}.</p>`,
        text: `Your subscription has been cancelled. Access ends on ${asStr(data['endDate'])}.`,
      };
    case 'subscription_renewal_reminder':
      return {
        subject: 'Your CueLane subscription renews soon',
        html: `<p>Your subscription renews on ${renewalDate}.</p>`,
        text: `Your subscription renews on ${asStr(data['renewalDate'])}.`,
      };
    default: {
      const rawBody = asStr(data['body']);
      const subject = asStr(data['subject']);
      return {
        subject: subject.length > 0 ? subject : 'CueLane notification',
        html: `<p>${escapeHtml(rawBody)}</p>`,
        text: rawBody,
      };
    }
  }
}

export async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { tenantId, to, subject, templateId, templateData } = job.data;

  const rendered = renderTemplate(templateId, templateData);
  const resolvedSubject = subject.length > 0 ? subject : rendered.subject;

  await transporter.sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM}>`,
    to,
    subject: resolvedSubject,
    html: rendered.html,
    text: rendered.text,
  });

  console.log(`[email] sent templateId=${templateId} tenant=${tenantId} job=${job.id ?? 'unknown'}`);
}
