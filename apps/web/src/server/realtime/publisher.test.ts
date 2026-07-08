// Wave 7.2-T1 — publisher unit tests (TDD: written alongside publisher.ts).
// Uses a fake ioredis-shaped client (no real Valkey dependency for this unit test — the
// end-to-end pub/sub path is proven separately against the real dev Valkey; see
// test-artifacts/phase7-wave72-sse/).
import { describe, expect, it, vi } from 'vitest';
import { __setPublisherClientForTests, publishEvents, queueChannel } from './publisher';
import type { DomainEvent } from '@/server/domain/queue';

describe('realtime publisher (Wave 7.2)', () => {
  it('queueChannel routes to the strict per-tenant channel name', () => {
    expect(queueChannel('tenant-abc')).toBe('tenant:tenant-abc:queue');
    expect(queueChannel('tenant-xyz')).not.toBe(queueChannel('tenant-abc'));
  });

  it('publishes each event as JSON to its own tenant channel', async () => {
    const publish = vi.fn().mockResolvedValue(1);
    __setPublisherClientForTests({ publish } as never);

    const events: DomainEvent[] = [
      { type: 'ticket.issued', tenantId: 'tenant-a', ticketId: 't1', payload: { number: 'A-001' } },
      { type: 'ticket.called', tenantId: 'tenant-b', ticketId: 't2' },
    ];

    await publishEvents(events);

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith('tenant:tenant-a:queue', JSON.stringify(events[0]));
    expect(publish).toHaveBeenCalledWith('tenant:tenant-b:queue', JSON.stringify(events[1]));

    __setPublisherClientForTests(null);
  });

  it('is a no-op for an empty events array (no client touched)', async () => {
    const publish = vi.fn();
    __setPublisherClientForTests({ publish } as never);

    await publishEvents([]);

    expect(publish).not.toHaveBeenCalled();
    __setPublisherClientForTests(null);
  });

  it('swallows a publish rejection — never throws into the caller', async () => {
    const publish = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    __setPublisherClientForTests({ publish } as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      publishEvents([{ type: 'ticket.completed', tenantId: 'tenant-a', ticketId: 't1' }]),
    ).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
    __setPublisherClientForTests(null);
  });
});
