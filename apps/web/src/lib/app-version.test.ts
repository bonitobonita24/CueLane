import { afterEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../package.json';
import nextConfig from '../../next.config';

describe('APP_VERSION (sidebar-footer version tag)', () => {
  const original = process.env['NEXT_PUBLIC_APP_VERSION'];

  afterEach(() => {
    if (original === undefined) delete process.env['NEXT_PUBLIC_APP_VERSION'];
    else process.env['NEXT_PUBLIC_APP_VERSION'] = original;
    vi.resetModules();
  });

  it('next.config bakes NEXT_PUBLIC_APP_VERSION from apps/web/package.json "version"', () => {
    expect(nextConfig.env?.['NEXT_PUBLIC_APP_VERSION']).toBe(packageJson.version);
  });

  it('APP_VERSION equals apps/web/package.json version when built with the next.config env', async () => {
    process.env['NEXT_PUBLIC_APP_VERSION'] = nextConfig.env?.['NEXT_PUBLIC_APP_VERSION'];
    vi.resetModules();
    const { APP_VERSION } = await import('./app-version');
    expect(APP_VERSION).toBe(packageJson.version);
  });

  it('never carries a hard-coded semver literal (the drift bug this guards against)', async () => {
    delete process.env['NEXT_PUBLIC_APP_VERSION'];
    vi.resetModules();
    const { APP_VERSION } = await import('./app-version');
    expect(APP_VERSION).toBe('0.0.0');
  });
});
