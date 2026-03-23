import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NatsTransport, NatsBridgeServer } from '../src/index.js';
import type { BridgeMessage } from '@carpentry/core/contracts';

const textEncoder = new TextEncoder();

function createMockConnection() {
  return {
    request: vi.fn().mockResolvedValue({ data: textEncoder.encode(JSON.stringify({ data: { result: 'ok' } })) }),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    publish: vi.fn(),
    drain: vi.fn().mockResolvedValue(undefined),
    isClosed: vi.fn().mockReturnValue(false),
  };
}

describe('NatsTransport', () => {
  let connection: ReturnType<typeof createMockConnection>;
  let transport: NatsTransport;

  beforeEach(() => {
    connection = createMockConnection();
    transport = new NatsTransport(
      { server: 'nats://localhost:4222', subjectPrefix: 'test.bridge' },
      { connection: connection as unknown as Parameters<typeof NatsTransport['prototype']['send']> extends never ? never : any },
    );
  });

  it('should be connected when connection provided', () => {
    expect(transport.isConnected()).toBe(true);
  });

  it('should send a message and receive response', async () => {
    const message: BridgeMessage<{ id: number }> = {
      id: 'msg-1',
      service: 'UserService',
      method: 'getUser',
      payload: { id: 42 },
      timestamp: Date.now(),
    };
    const response = await transport.send(message);
    expect(response.data).toEqual({ result: 'ok' });
    expect(connection.request).toHaveBeenCalledWith(
      'test.bridge.UserService',
      expect.any(Uint8Array),
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('should handle send errors gracefully', async () => {
    connection.request.mockRejectedValue(new Error('No responders'));
    const response = await transport.send({
      id: 'msg-2', service: 'Dead', method: 'test', payload: {}, timestamp: Date.now(),
    });
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('should disconnect', async () => {
    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);
    // connection not owned, so drain not called
    expect(connection.drain).not.toHaveBeenCalled();
  });

  it('should connect via driver loader when no connection provided', async () => {
    const mockConn = createMockConnection();
    const mockDriverLoader = vi.fn().mockResolvedValue({
      connect: vi.fn().mockResolvedValue(mockConn),
    });
    const newTransport = new NatsTransport(
      { server: 'nats://localhost:4222' },
      { driverLoader: mockDriverLoader },
    );
    await newTransport.connect();
    expect(newTransport.isConnected()).toBe(true);
    expect(mockDriverLoader).toHaveBeenCalled();
  });
});

describe('NatsBridgeServer', () => {
  let connection: ReturnType<typeof createMockConnection>;
  let server: NatsBridgeServer;

  beforeEach(() => {
    connection = createMockConnection();
    server = new NatsBridgeServer(
      { server: 'nats://localhost:4222', subjectPrefix: 'test.bridge' },
      { connection: connection as any },
    );
  });

  it('should register handler and subscribe on connect', async () => {
    server.onRequest('UserService', async (req) => ({ data: { user: 'Alice' } }));
    await server.connect();
    expect(server.isConnected()).toBe(true);
    expect(connection.subscribe).toHaveBeenCalledWith(
      'test.bridge.UserService',
      expect.objectContaining({ callback: expect.any(Function) }),
    );
  });

  it('should disconnect and unsubscribe', async () => {
    server.onRequest('Test', async () => ({ data: {} }));
    await server.connect();
    await server.disconnect();
    expect(server.isConnected()).toBe(false);
  });

  it('should handle incoming request and publish reply', async () => {
    server.onRequest('EchoService', async (req) => ({ data: req.payload }));
    await server.connect();
    // Simulate incoming message
    const subscribeCall = connection.subscribe.mock.calls[0];
    const callback = subscribeCall[1].callback;
    const incomingData = textEncoder.encode(JSON.stringify({
      id: 'req-1', service: 'EchoService', method: 'echo', payload: { msg: 'hello' }, timestamp: Date.now(),
    }));
    // callback triggers async handling internally via void, need to wait for microtask
    callback(null, { data: incomingData, reply: 'reply.subject' });
    await new Promise((r) => setTimeout(r, 10));
    expect(connection.publish).toHaveBeenCalledWith('reply.subject', expect.any(Uint8Array));
  });
});
