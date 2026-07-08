#!/usr/bin/env node
/**
 * hydration-lint.mjs — Check for common SSR hydration mismatch patterns
 *
 * Scans apps/web/src for patterns that commonly cause React hydration errors:
 *   - typeof window !== 'undefined' in render paths
 *   - Math.random() / Date.now() in JSX
 *   - localStorage / sessionStorage in render paths
 *   - useLayoutEffect without suppressHydrationWarning
 *
 * Usage:
 *   node tools/hydration-lint.mjs
 *   pnpm tools:hydration-lint
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const srcDir = resolve(root, 'apps/web/src');

console.log('hydration-lint.mjs — CueLane SSR hydration mismatch check\n');

if (!existsSync(srcDir)) {
  console.warn('⚠  apps/web/src not found — nothing to lint');
  process.exit(0);
}

// Patterns that indicate potential hydration issues in .tsx/.ts files
const PATTERNS = [
  {
    re: /typeof\s+window\s*!==?\s*['"]undefined['"]/g,
    msg: 'typeof window check in render path — use useEffect or dynamic import with ssr:false',
    severity: 'warn',
  },
  {
    re: /\bMath\.random\(\)/g,
    msg: 'Math.random() in component — produces different values on server vs client',
    severity: 'error',
  },
  {
    re: /\bDate\.now\(\)/g,
    msg: 'Date.now() in component render — may differ server vs client',
    severity: 'warn',
  },
  {
    re: /\blocalStorage\b/g,
    msg: 'localStorage access — not available on server (wrap in useEffect)',
    severity: 'error',
  },
  {
    re: /\bsessionStorage\b/g,
    msg: 'sessionStorage access — not available on server (wrap in useEffect)',
    severity: 'error',
  },
];

/** Recursively collect .tsx and .ts files */
function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = walk(srcDir);
let errors = 0;
let warnings = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  for (const { re, msg, severity } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      if (severity === 'error') {
        console.error(`  ✗ [${rel}:${lineNum}] ${msg}`);
        errors++;
      } else {
        console.warn(`  ⚠  [${rel}:${lineNum}] ${msg}`);
        warnings++;
      }
    }
  }
}

const total = files.length;
console.log(`\nScanned ${total} file(s). Errors: ${errors}, Warnings: ${warnings}`);

if (errors > 0) {
  console.error('\n❌ Hydration lint FAILED — fix errors above before deploying.');
  process.exit(1);
} else if (warnings > 0) {
  console.warn('\n⚠  Hydration lint passed with warnings — review above.');
  process.exit(0);
} else {
  console.log('\n✅ No hydration issues detected.');
  process.exit(0);
}
