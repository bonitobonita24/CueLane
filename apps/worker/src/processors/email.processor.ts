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

function renderTemplate(
  templateId: string,
  data: Record<string, unknown>,
): { subject: string; html: string; text: string } {
  const url = escapeHtml(String(data['url'] ?? ''));
  const plan = escapeHtml(String(data['plan'] ?? ''));
  const endDate = escapeHtml(String(data['endDate'] ?? ''));
  const renewalDate = escapeHtml(String(data['renewalDate'] ?? ''));

  switch (templateId) {
    case 'email_verification':
      return {
        subject: 'Verify your CueLane account',
        html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
        text: `Verify your email: ${String(data['url'] ?? '')}`,
      };
    case 'password_reset':
      return {
        subject: 'Reset your CueLane password',
        html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1 hour.</p>`,
        text: `Reset your password: ${String(data['url'] ?? '')}`,
      };
    case 'subscription_confirmation':
      return {
        subject: 'Your CueLane subscription is confirmed',
        html: `<p>Your subscription to plan <strong>${plan}</strong> is now active.</p>`,
        text: `Your subscription to ${String(data['plan'] ?? '')} is now active.`,
      };
    case 'subscription_cancellation':
      return {
        subject: 'Your CueLane subscription has been cancelled',
        html: `<p>Your subscription has been cancelled. Access ends on ${endDate}.</p>`,
        text: `Your subscription has been cancelled. Access ends on ${String(data['endDate'] ?? '')}.`,
      };
    case 'subscription_renewal_reminder':
      return {
        subject: 'Your CueLane subscription renews soon',
        html: `<p>Your subscription renews on ${renewalDate}.</p>`,
        text: `Your subscription renews on ${String(data['renewalDate'] ?? '')}.`,
      };
    default: {
      const body = escapeHtml(String(data['body'] ?? ''));
      return {
        subject: data['subject'] !== undefined ? String(data['subject']) : 'CueLane notification',
        html: `<p>${body}</p>`,
        text: String(data['body'] ?? ''),
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
