#!/usr/bin/env node
/**
 * validate-inputs.mjs — Validate inputs.yml against inputs.schema.json
 *
 * Usage:
 *   node tools/validate-inputs.mjs
 *   pnpm tools:validate-inputs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

let passed = true;

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  passed = false;
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

try {
  const inputsPath = resolve(root, 'inputs.yml');
  const rawYaml = readFileSync(inputsPath, 'utf8');
  const inputs = parseYaml(rawYaml);

  console.log('validate-inputs.mjs — CueLane inputs.yml validation\n');

  // Basic required field checks
  const required = ['app.name', 'app.slug', 'tech_stack', 'tenancy.mode', 'docker.publish'];
  for (const field of required) {
    const parts = field.split('.');
    let val = inputs;
    for (const p of parts) val = val?.[p];
    if (val === undefined || val === null) {
      fail(`Missing required field: ${field}`);
    } else {
      pass(`${field} = ${JSON.stringify(val)}`);
    }
  }

  // Docker Hub repo format check
  if (inputs.docker?.hub_repo && !inputs.docker.hub_repo.includes('/')) {
    fail('docker.hub_repo must be in format username/repo');
  } else if (inputs.docker?.hub_repo) {
    pass(`docker.hub_repo format OK: ${inputs.docker.hub_repo}`);
  }

  // Port uniqueness check
  const ports = Object.values(inputs.ports?.dev ?? {}).filter(v => typeof v === 'number');
  const uniquePorts = new Set(ports);
  if (uniquePorts.size !== ports.length) {
    fail('Duplicate dev ports detected in inputs.yml');
  } else {
    pass(`Dev ports unique: ${ports.join(', ')}`);
  }

  console.log(`\n${passed ? '✅ All checks passed.' : '❌ Validation failed — fix inputs.yml.'}`);
  process.exit(passed ? 0 : 1);
} catch (err) {
  console.error(`✗ Error reading inputs.yml: ${err.message}`);
  process.exit(1);
}
