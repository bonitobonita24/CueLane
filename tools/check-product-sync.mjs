#!/usr/bin/env node
/**
 * check-product-sync.mjs — Validate PRODUCT.md ↔ inputs.yml alignment
 * Also checks that no <private> tag content leaked into governance docs (Rule 20).
 *
 * Usage:
 *   node tools/check-product-sync.mjs
 *   pnpm tools:check-product-sync
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

console.log('check-product-sync.mjs — CueLane PRODUCT.md ↔ inputs.yml sync check\n');

let passed = true;

function fail(msg) { console.error(`  ✗ ${msg}`); passed = false; }
function pass(msg)  { console.log(`  ✓ ${msg}`); }
function warn(msg)  { console.warn(`  ⚠  ${msg}`); }

// ── Rule 20: private tag leak check ──────────────────────────────────────────
const GOVERNANCE_DOCS = [
  'docs/CHANGELOG_AI.md',
  'docs/DECISIONS_LOG.md',
  'docs/IMPLEMENTATION_MAP.md',
  'docs/STATE.md',
  'inputs.yml',
];

const PRIVATE_TAG_RE = /<private>[\s\S]*?<\/private>/i;

console.log('=== Rule 20 — Private tag leak check ===');
for (const docPath of GOVERNANCE_DOCS) {
  const fullPath = resolve(root, docPath);
  if (!existsSync(fullPath)) { warn(`not found: ${docPath}`); continue; }
  const content = readFileSync(fullPath, 'utf8');
  if (PRIVATE_TAG_RE.test(content)) {
    fail(`Private tag content leaked into: ${docPath}`);
  } else {
    pass(`${docPath} — no private tags`);
  }
}

// ── PRODUCT.md ↔ inputs.yml sync ─────────────────────────────────────────────
console.log('\n=== PRODUCT.md ↔ inputs.yml alignment ===');

const inputsPath = resolve(root, 'inputs.yml');
const productPath = resolve(root, 'docs/PRODUCT.md');

if (!existsSync(inputsPath)) { fail('inputs.yml not found'); process.exit(1); }
if (!existsSync(productPath)) { warn('docs/PRODUCT.md not found — skipping alignment check'); }

const inputs = parseYaml(readFileSync(inputsPath, 'utf8'));

// App name consistency
if (inputs.app?.name) {
  pass(`inputs.yml app.name: ${inputs.app.name}`);
} else {
  fail('inputs.yml missing app.name');
}

// Docker config sanity
if (inputs.docker?.publish === true) {
  if (inputs.docker.hub_repo && inputs.docker.image_name) {
    pass(`docker config: ${inputs.docker.hub_repo}/${inputs.docker.image_name}`);
  } else {
    fail('docker.publish=true but hub_repo or image_name missing');
  }
}

// Tenancy mode
if (inputs.tenancy?.mode) {
  pass(`tenancy.mode: ${inputs.tenancy.mode}`);
} else {
  fail('tenancy.mode not defined in inputs.yml');
}

// Ports in range (avoid well-known port conflicts)
const devPorts = Object.entries(inputs.ports?.dev ?? {}).filter(([, v]) => typeof v === 'number');
for (const [name, port] of devPorts) {
  if (port < 1024 || port > 65535) {
    fail(`ports.dev.${name}=${port} is out of valid range`);
  } else {
    pass(`ports.dev.${name}=${port}`);
  }
}

console.log(`\n${passed ? '✅ Sync check passed.' : '❌ Sync check failed — review above issues.'}`);
process.exit(passed ? 0 : 1);
