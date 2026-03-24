import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { KafkaTransport, KafkaBridgeServer } from '@carpentry/bridge-kafka';
import type { BridgeMessage } from '@carpentry/core/contracts';
import { KAFKA_BASE, connectWithRetry } from './support.js';

describe('real-services/KafkaTransport', { timeout: 60_000 }, () => {
  let server: KafkaBridgeServer;
  let transport: KafkaTransport;

  beforeAll(async () => {
    server = await connectWithRetry(() => {
      const s = new KafkaBridgeServer({
        ...KAFKA_BASE,
        clientId: 'carpenter-real-test-server',
        consumerGroupId: 'carpenter-real-test-server-cg',
      });
      s.onRequest('EchoService', async (req) => ({
        id: req.id,
        data: { echo: (req.payload as { text: string }).text },
      }));
      return s;
    });

    transport = await connectWithRetry(
      () =>
        new KafkaTransport({
          ...KAFKA_BASE,
          clientId: 'carpenter-real-test-client',
          consumerGroupId: 'carpenter-real-test-client-cg',
        }),
    );
  }, 60_000);

  afterAll(async () => {
    await transport.disconnect();
    await server.disconnect();
  });

  it('reports connected state', () => {
    expect(transport.isConnected()).toBe(true);
    expect(server.isConnected()).toBe(true);
  });

  it('sends request and receives echo response', async () => {
    const msg: BridgeMessage<{ text: string }> = {
      id: 'kafka-real-1',
      service: 'EchoService',
      method: 'echo',
      payload: { text: 'hello-kafka' },
      timestamp: Date.now(),
    };
    const response = await transport.send(msg);
    expect(response.error).toBeUndefined();
    expect(response.data).toEqual({ echo: 'hello-kafka' });
  });
});
