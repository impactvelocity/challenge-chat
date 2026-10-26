import { describe, expect, it } from 'vitest';
import { KILL_CHALLENGE_EXAMPLE } from '../src/examples/kill-challenge';
import type { LiveRunProjection } from '../shared/framework';
import { LiveSessionCoordinator } from './live-session';

class MemoryStorage {
  private readonly values = new Map<string, unknown>();
  alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put(keyOrEntries: string | Record<string, unknown>, value?: unknown): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      this.values.set(keyOrEntries, value);
      return;
    }
    for (const [key, entry] of Object.entries(keyOrEntries)) this.values.set(key, entry);
  }

  async setAlarm(value: number): Promise<void> {
    this.alarm = value;
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }

  async deleteAll(): Promise<void> {
    this.values.clear();
  }
}

describe('Cloudflare live-session custom game events', () => {
  it('broadcasts an idempotent kill metric update to overlay sockets', async () => {
    const messages: string[] = [];
    const socket = {
      deserializeAttachment: () => ({ role: 'overlay' }),
      send: (message: string) => messages.push(message),
      close: () => undefined,
    } as unknown as WebSocket;
    const state = {
      storage: new MemoryStorage(),
      getWebSockets: () => [socket],
    } as unknown as DurableObjectState;
    const coordinator = new LiveSessionCoordinator(state);

    const create = await coordinator.fetch(new Request('https://coordinator/framework/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition: { ...KILL_CHALLENGE_EXAMPLE, countdownSeconds: 0 } }),
    }));
    expect(create.status).toBe(201);
    const created = await create.json() as { projection: LiveRunProjection };
    expect(created.projection.status).toBe('active');
    expect(created.projection.metrics[0]).toMatchObject({ id: 'kills', value: 0, target: 10 });

    const event = {
      source: 'horror-game',
      idempotencyKey: 'horror-game:match-27-kill-8',
      occurredAt: new Date().toISOString(),
      event: { type: 'metric.incremented', metric: 'kills', by: 1 },
    };
    const publish = () => coordinator.fetch(new Request(`https://coordinator/framework/runs/${created.projection.runId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }));

    const updatedResponse = await publish();
    expect(updatedResponse.status).toBe(200);
    const updated = await updatedResponse.json() as { projection: LiveRunProjection; duplicate: boolean };
    expect(updated.duplicate).toBe(false);
    expect(updated.projection.metrics[0]).toMatchObject({ id: 'kills', value: 1, target: 10 });

    const socketUpdate = JSON.parse(messages.at(-1)!) as { type: string; projection: LiveRunProjection };
    expect(socketUpdate.type).toBe('framework.run.changed');
    expect(socketUpdate.projection.metrics[0]).toMatchObject({ id: 'kills', value: 1, target: 10 });

    const broadcastCount = messages.length;
    const duplicateResponse = await publish();
    const duplicate = await duplicateResponse.json() as { projection: LiveRunProjection; duplicate: boolean };
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.projection.metrics[0].value).toBe(1);
    expect(messages).toHaveLength(broadcastCount);
  });

  it('projects a validated Twitch fact as an overlay-only transient moment', async () => {
    const overlayMessages: string[] = [];
    const adminMessages: string[] = [];
    const socket = (role: 'overlay' | 'admin', messages: string[]) => ({
      deserializeAttachment: () => ({ role, ...(role === 'admin' ? { expiresAt: Date.now() + 60_000 } : {}) }),
      send: (message: string) => messages.push(message),
      close: () => undefined,
    }) as unknown as WebSocket;
    const state = {
      storage: new MemoryStorage(),
      getWebSockets: () => [socket('overlay', overlayMessages), socket('admin', adminMessages)],
    } as unknown as DurableObjectState;
    const coordinator = new LiveSessionCoordinator(state);
    const response = await coordinator.fetch(new Request('https://coordinator/internal/integration-moment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'twitch',
        moment: { kind: 'raid', user: 'RaidLeader', amount: 42, occurredAt: new Date().toISOString(), providerEventId: 'raid-1' },
      }),
    }));
    expect(response.status).toBe(200);
    expect(overlayMessages.map((message) => JSON.parse(message))).toEqual([expect.objectContaining({
      type: 'integration.moment',
      source: 'twitch',
      moment: expect.objectContaining({ kind: 'raid', user: 'RaidLeader', amount: 42 }),
    })]);
    expect(adminMessages).toEqual([]);
  });
});
