import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NatsTransport, NatsBridgeServer } from '@carpentry/bridge-nats';
import type { BridgeMessage } from '@carpentry/core/contracts';
import { NATS_URL } from './support.js';

describe('real-services/NatsTransport', { timeout: 15_000 }, () => {
  let server: NatsBridgeServer;
  let transport: NatsTransport;

  beforeAll(async () => {
    server = new NatsBridgeServer({ server: NATS_URL, subjectPrefix: 'real.test' });
    server.onRequest('GreetService', async (req) => ({
      id: req.id,
      data: { greeting: `Hello, ${(req.payload as { name: string }).name}!` },
    }));
    await server.connect();

    transport = new NatsTransport({ server: NATS_URL, subjectPrefix: 'real.test' });
    await transport.connect();
  });

  afterAll(async () => {
    await transport.disconnect();
    await server.disconnect();
  });

  it('reports connected state and round-trips requests', async () => {
    expect(transport.isConnected()).toBe(true);
    expect(server.isConnected()).toBe(true);

    const msg: BridgeMessage<{ name: string }> = {
      id: 'nats-real-1',
      service: 'GreetService',
      method: 'greet',
      payload: { name: 'Carpenter' },
      timestamp: Date.now(),
    };
    const response = await transport.send(msg);
    expect(response.error).toBeUndefined();
    expect(response.data).toEqual({ greeting: 'Hello, Carpenter!' });
  });

  it('returns error response for unregistered services', async () => {
    const msg: BridgeMessage = {
      id: 'nats-real-2',
      service: 'NoSuchService',
      method: 'call',
      payload: {},
      timestamp: Date.now(),
    };
    const response = await transport.send(msg);
    expect(response.error).toBeDefined();
  });
});
