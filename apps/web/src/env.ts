import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  // Cache
  VALKEY_URL: z.string().min(1),
  // Auth
  AUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url().optional(),
  // MinIO / S3 storage
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default('cuelane'),
  // SMTP email
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().min(1).default('noreply@cuelane.app'),
  // Cloudflare Turnstile
  TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  // Xendit payment gateway (optional in dev)
  XENDIT_SECRET_KEY: z.string().min(1).optional(),
  XENDIT_WEBHOOK_TOKEN: z.string().min(1).optional(),
  // Runtime
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

// Allow build-time / CI to skip runtime validation
const skip =
  process.env['SKIP_ENV_VALIDATION'] === 'true' ||
  process.env['NEXT_PHASE'] === 'phase-production-build';

const _parsed = envSchema.safeParse(process.env);

if (!skip && !_parsed.success) {
  console.error('❌ Invalid environment variables:', _parsed.error.format());
  throw new Error('Invalid environment variables. Check server logs.');
}

export const env = (
  skip ? (process.env as unknown) : _parsed.data
) as z.infer<typeof envSchema>;
