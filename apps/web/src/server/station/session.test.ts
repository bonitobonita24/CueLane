// Wave 7.4-T1 — station session unit tests (TDD: written alongside session.ts). Uses a fake
// ioredis-shaped client (same convention as realtime/publisher.test.ts) — the end-to-end path
// against real Valkey is proven by the Playwright E2E run (a window survives a page reload).
import { describe, expect, it, vi } from 'vitest';
import { __setSessionClientForTests, getStationWindow, setStationWindow } from './session';

describe('station session (Wave 7.4-T1)', () => {
  it('getStationWindow returns null when no key is set', async () => {
    const get = vi.fn().mockResolvedValue(null);
    __setSessionClientForTests({ get } as never);

    const result = await getStationWindow('tenant-a', 'user-a');

    expect(result).toBeNull();
    expect(get).toHaveBeenCalledWith('station:tenant-a:user-a');
    __setSessionClientForTests(null);
  });

  it('getStationWindow returns the stored windowId, strictly scoped per tenant+user', async () => {
    const get = vi.fn().mockResolvedValue('window-123');
    __setSessionClientForTests({ get } as never);

    const result = await getStationWindow('tenant-a', 'user-a');

    expect(result).toBe('window-123');
    __setSessionClientForTests(null);
  });

  it('setStationWindow writes with a TTL under the tenant+user-scoped key', async () => {
    const set = vi.fn().mockResolvedValue('OK');
    __setSessionClientForTests({ set } as never);

    await setStationWindow('tenant-a', 'user-a', 'window-123');

    expect(set).toHaveBeenCalledWith('station:tenant-a:user-a', 'window-123', 'EX', 12 * 60 * 60);
    __setSessionClientForTests(null);
  });

  it('getStationWindow swallows a read failure and returns null (never throws)', async () => {
    const get = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    __setSessionClientForTests({ get } as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getStationWindow('tenant-a', 'user-a')).resolves.toBeNull();

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
    __setSessionClientForTests(null);
  });

  it('setStationWindow swallows a write failure — never throws into the caller', async () => {
    const set = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    __setSessionClientForTests({ set } as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(setStationWindow('tenant-a', 'user-a', 'window-123')).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
    __setSessionClientForTests(null);
  });
});
