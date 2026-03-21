import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrpcTransport, GrpcBridgeServer } from '../src/index.js';
import type { BridgeMessage } from '@formwork/core/contracts';

function createMockGrpcDriver() {
  const mockMetadata = { set: vi.fn() };
  const mockClient = {
    makeUnaryRequest: vi.fn((_method: unknown, _ser: unknown, _deser: unknown, _arg: unknown, _meta: unknown, _opts: unknown, callback: (err: Error | null, value?: unknown) => void) => {
      callback(null, { data: { result: 'ok' } });
    }),
    waitForReady: vi.fn((_deadline: unknown, callback: (err?: Error) => void) => callback()),
    close: vi.fn(),
  };
  const mockServer = {
    addService: vi.fn(),
    bindAsync: vi.fn((_addr: unknown, _creds: unknown, callback: (err: Error | null, port: number) => void) => callback(null, 50051)),
    start: vi.fn(),
    tryShutdown: vi.fn((callback: (err?: Error) => void) => callback()),
  };
  function Client() { return mockClient; }
  function Server() { return mockServer; }
  function Metadata() { return mockMetadata; }
  return {
    Client: Client as unknown as new (...args: unknown[]) => typeof mockClient,
    Server: Server as unknown as new () => typeof mockServer,
    Metadata: Metadata as unknown as new () => typeof mockMetadata,
    credentials: { createInsecure: vi.fn().mockReturnValue({}) },
    ServerCredentials: { createInsecure: vi.fn().mockReturnValue({}) },
    _client: mockClient,
    _server: mockServer,
  };
}

describe('GrpcTransport', () => {
  let driver: ReturnType<typeof createMockGrpcDriver>;
  let transport: GrpcTransport;

  beforeEach(() => {
    driver = createMockGrpcDriver();
    transport = new GrpcTransport(
      { target: 'localhost:50051' },
      { driverLoader: vi.fn().mockResolvedValue(driver) },
    );
  });

  it('should connect successfully', async () => {
    await transport.connect();
    expect(transport.isConnected()).toBe(true);
  });

  it('should send a message and receive response', async () => {
    await transport.connect();
    const message: BridgeMessage<{ id: number }> = {
      id: 'msg-1',
      service: 'UserService',
      method: 'getUser',
      payload: { id: 42 },
      timestamp: Date.now(),
    };
    const response = await transport.send(message);
    expect(response.data).toEqual({ result: 'ok' });
    expect(driver._client.makeUnaryRequest).toHaveBeenCalled();
  });

  it('should handle send errors gracefully', async () => {
    driver._client.makeUnaryRequest.mockImplementation(
      (_m: unknown, _s: unknown, _d: unknown, _a: unknown, _meta: unknown, _o: unknown, cb: (err: Error) => void) => cb(new Error('connection failed')),
    );
    await transport.connect();
    const response = await transport.send({
      id: 'msg-2', service: 'Test', method: 'fail', payload: {}, timestamp: Date.now(),
    });
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe('GRPC_ERROR');
  });

  it('should disconnect', async () => {
    await transport.connect();
    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);
    expect(driver._client.close).toHaveBeenCalled();
  });

  it('should throw when sending without connection', async () => {
    await expect(transport.send({
      id: 'x', service: 'Test', method: 'test', payload: {}, timestamp: Date.now(),
    })).rejects.toThrow('not connected');
  });
});

describe('GrpcBridgeServer', () => {
  let driver: ReturnType<typeof createMockGrpcDriver>;
  let server: GrpcBridgeServer;

  beforeEach(() => {
    driver = createMockGrpcDriver();
    server = new GrpcBridgeServer(
      { host: '127.0.0.1', port: 50051 },
      { driverLoader: vi.fn().mockResolvedValue(driver) },
    );
  });

  it('should start server', async () => {
    await server.connect();
    expect(server.isConnected()).toBe(true);
    expect(driver._server.addService).toHaveBeenCalled();
    expect(driver._server.start).toHaveBeenCalled();
  });

  it('should register request handlers', () => {
    server.onRequest('UserService', async (req) => ({ data: { user: 'Alice' } }));
    // No error
  });

  it('should stop server', async () => {
    await server.connect();
    await server.disconnect();
    expect(server.isConnected()).toBe(false);
    expect(driver._server.tryShutdown).toHaveBeenCalled();
  });

  it('should return target address', async () => {
    await server.connect();
    expect(server.getTarget()).toBe('127.0.0.1:50051');
  });
});
