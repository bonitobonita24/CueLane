#!/usr/bin/env node
/**
 * check-env.mjs — Check that required environment variables are set
 *
 * Usage:
 *   node tools/check-env.mjs [--env dev|staging|prod]
 *   pnpm tools:check-env
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const envArg = process.argv.indexOf('--env');
const envName = envArg !== -1 ? process.argv[envArg + 1] : 'dev';

// Map to .env file
const envFile = envName === 'dev'
  ? resolve(root, '.env.dev')
  : envName === 'staging'
    ? resolve(root, '.env.staging')
    : resolve(root, '.env.prod');

// Required vars by category
const REQUIRED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'REDIS_URL',
  'AUTH_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'STORAGE_ENDPOINT',
  'STORAGE_ACCESS_KEY',
  'STORAGE_SECRET_KEY',
  'STORAGE_BUCKET',
];

const OPTIONAL = [
  'XENDIT_SECRET_KEY',
  'XENDIT_WEBHOOK_TOKEN',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
];

console.log(`check-env.mjs — CueLane ${envName} environment check\n`);

if (!existsSync(envFile)) {
  console.error(`✗ Env file not found: ${envFile}`);
  console.error(`  Copy ${envFile.replace('.env.', '.env.') + '.example'} to get started.`);
  process.exit(1);
}

// Parse .env file
const envContent = readFileSync(envFile, 'utf8');
const envMap = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  envMap[key] = val;
}

let passed = true;

for (const key of REQUIRED) {
  const val = envMap[key] ?? process.env[key];
  if (!val || val.includes('CHANGE_ME')) {
    console.error(`  ✗ MISSING or placeholder: ${key}`);
    passed = false;
  } else {
    console.log(`  ✓ ${key}`);
  }
}

for (const key of OPTIONAL) {
  const val = envMap[key] ?? process.env[key];
  if (!val || val.includes('CHANGE_ME')) {
    console.warn(`  ⚠  optional/placeholder: ${key}`);
  } else {
    console.log(`  ✓ ${key}`);
  }
}

console.log(`\n${passed ? '✅ All required env vars present.' : '❌ Missing required env vars — fill in ' + envFile}`);
process.exit(passed ? 0 : 1);
