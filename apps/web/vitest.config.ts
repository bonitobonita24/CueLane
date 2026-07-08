// Wave 7.1 — vitest config for @cuelane/web server-side tests (domain + tRPC router).
// No React/DOM tests yet, so environment stays 'node'. The '@' alias mirrors tsconfig.json's
// paths so `import ... from '@/server/...'` resolves the same way it does in the Next.js build.
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Domain/router tests hit the real dev Postgres DB (no mocks, per framework convention) —
    // run test FILES serially so ephemeral fixture tenants never interleave with each other's
    // atomic sequence-counter assertions across files.
    fileParallelism: false,
  },
});
