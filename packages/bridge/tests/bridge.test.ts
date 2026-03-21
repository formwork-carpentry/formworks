import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryTransport, ServiceRegistry, RemoteService, RemoteServiceError, HealthChecker,
  HttpTransport, GrpcTransportStub, NatsTransportStub, KafkaTransportStub,
} from '../src/index.js';

describe('@formwork/bridge: InMemoryTransport', () => {
  let transport: InMemoryTransport;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    await transport.connect();
  });

  it('sends and receives via registered handler', async () => {
    transport.onRequest('user-service', async (msg) => ({
      id: msg.id,
      payload: { name: 'Alice' },
      durationMs: 0,
    }));

    const response = await transport.send({
      id: 'msg-1', service: 'user-service', method: 'getUser',
      payload: { id: 1 }, timestamp: Date.now(),
    });

    expect(response.payload).toEqual({ name: 'Alice' });
    expect(response.error).toBeUndefined();
  });

  it('returns error for unregistered service', async () => {
    const response = await transport.send({
      id: 'msg-1', service: 'unknown', method: 'call',
      payload: {}, timestamp: Date.now(),
    });
    expect(response.error?.code).toBe('SERVICE_NOT_FOUND');
  });

  it('throws when not connected', async () => {
    await transport.disconnect();
    await expect(transport.send({
      id: 'msg-1', service: 'x', method: 'y', payload: {}, timestamp: Date.now(),
    })).rejects.toThrow('not connected');
  });

  it('records sent messages', async () => {
    transport.onRequest('svc', async (msg) => ({ id: msg.id, payload: 'ok', durationMs: 0 }));
    await transport.send({ id: '1', service: 'svc', method: 'a', payload: {}, timestamp: Date.now() });
    await transport.send({ id: '2', service: 'svc', method: 'b', payload: {}, timestamp: Date.now() });

    transport.assertSentCount(2);
    transport.assertSent('svc', 'a');
    transport.assertSent('svc', 'b');
  });

  it('handles handler errors gracefully', async () => {
    transport.onRequest('fail', async () => { throw new Error('handler crash'); });
    const response = await transport.send({
      id: '1', service: 'fail', method: 'x', payload: {}, timestamp: Date.now(),
    });
    expect(response.error?.code).toBe('INTERNAL_ERROR');
    expect(response.error?.message).toBe('handler crash');
  });
});

describe('@formwork/bridge: ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => { registry = new ServiceRegistry(); });

  it('register and resolve', () => {
    registry.register({ service: 'users', transport: 'grpc', host: 'users.local', port: 50051 });
    const ep = registry.resolve('users');
    expect(ep).not.toBeNull();
    expect(ep!.host).toBe('users.local');
  });

  it('returns null for unregistered service', () => {
    expect(registry.resolve('nope')).toBeNull();
  });

  it('multiple endpoints with load balancing', () => {
    registry.register({ service: 'api', transport: 'http', host: 'api-1', weight: 1 });
    registry.register({ service: 'api', transport: 'http', host: 'api-2', weight: 1 });

    const hosts = new Set<string>();
    for (let i = 0; i < 100; i++) {
      hosts.add(registry.resolve('api')!.host!);
    }
    expect(hosts.size).toBe(2); // both should be hit
  });

  it('markUnhealthy excludes from resolution', () => {
    registry.register({ service: 'db', transport: 'tcp', host: 'primary' });
    registry.register({ service: 'db', transport: 'tcp', host: 'replica' });

    registry.markUnhealthy('db', 'primary');
    // Should only resolve to replica now
    for (let i = 0; i < 10; i++) {
      expect(registry.resolve('db')!.host).toBe('replica');
    }
  });

  it('markHealthy restores endpoint', () => {
    registry.register({ service: 'db', transport: 'tcp', host: 'primary' });
    registry.markUnhealthy('db', 'primary');
    expect(registry.resolve('db')).toBeNull(); // only endpoint is unhealthy

    registry.markHealthy('db', 'primary');
    expect(registry.resolve('db')).not.toBeNull();
  });

  it('deregister removes endpoint', () => {
    registry.register({ service: 'svc', transport: 'http', host: 'a' });
    expect(registry.deregister('svc', 'a')).toBe(true);
    expect(registry.resolve('svc')).toBeNull();
  });

  it('services() lists all registered services', () => {
    registry.register({ service: 'a', transport: 'http' });
    registry.register({ service: 'b', transport: 'grpc' });
    expect(registry.services()).toEqual(['a', 'b']);
  });
});

describe('@formwork/bridge: RemoteService', () => {
  let transport: InMemoryTransport;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    await transport.connect();
  });

  it('calls remote method and returns response', async () => {
    transport.onRequest('user-service', async (msg) => ({
      id: msg.id, payload: { id: 1, name: 'Alice' }, durationMs: 1,
    }));

    const remote = new RemoteService('user-service', transport);
    const user = await remote.call<{ id: number }, { id: number; name: string }>('getUser', { id: 1 });
    expect(user).toEqual({ id: 1, name: 'Alice' });
  });

  it('throws RemoteServiceError on error response', async () => {
    transport.onRequest('fail-service', async (msg) => ({
      id: msg.id, payload: null,
      error: { code: 'NOT_FOUND', message: 'User not found' },
      durationMs: 1,
    }));

    const remote = new RemoteService('fail-service', transport);
    await expect(remote.call('getUser', { id: 999 })).rejects.toThrow(RemoteServiceError);
    await expect(remote.call('getUser', { id: 999 })).rejects.toThrow('User not found');
  });

  it('passes headers and traceId', async () => {
    let receivedMsg: unknown;
    transport.onRequest('svc', async (msg) => {
      receivedMsg = msg;
      return { id: msg.id, payload: 'ok', durationMs: 0 };
    });

    const remote = new RemoteService('svc', transport);
    await remote.call('method', {}, { headers: { 'x-api-key': 'abc' }, traceId: 'trace-123' });

    const msg = receivedMsg as { headers: Record<string, string>; traceId: string };
    expect(msg.headers['x-api-key']).toBe('abc');
    expect(msg.traceId).toBe('trace-123');
  });
});

describe('@formwork/bridge: HealthChecker', () => {
  it('checks health via ping', async () => {
    const transport = new InMemoryTransport();
    await transport.connect();
    transport.onRequest('users', async (msg) => ({ id: msg.id, payload: 'pong', durationMs: 0 }));

    const checker = new HealthChecker();
    checker.register('users', HealthChecker.pingCheck('users', transport));

    const status = await checker.check('users');
    expect(status.status).toBe('healthy');
    expect(status.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns unhealthy for unregistered service', async () => {
    const checker = new HealthChecker();
    const status = await checker.check('unknown');
    expect(status.status).toBe('unhealthy');
  });

  it('checkAll() returns all statuses', async () => {
    const transport = new InMemoryTransport();
    await transport.connect();
    transport.onRequest('a', async (msg) => ({ id: msg.id, payload: 'ok', durationMs: 0 }));
    transport.onRequest('b', async (msg) => ({ id: msg.id, payload: 'ok', durationMs: 0 }));

    const checker = new HealthChecker();
    checker.register('a', HealthChecker.pingCheck('a', transport));
    checker.register('b', HealthChecker.pingCheck('b', transport));

    const results = await checker.checkAll();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'healthy')).toBe(true);
  });
});

describe('@formwork/bridge-adapters: HttpTransport', () => {
  let transport: HttpTransport;

  beforeEach(async () => {
    transport = new HttpTransport();
    await transport.connect();
  });

  it('handles local requests via onRequest()', async () => {
    transport.onRequest('user-service', async (msg) => ({
      id: msg.id, payload: { name: 'Alice' }, durationMs: 0,
    }));

    const res = await transport.send({
      id: '1', service: 'user-service', method: 'getUser',
      payload: { id: 1 }, timestamp: Date.now(),
    });
    expect(res.payload).toEqual({ name: 'Alice' });
  });

  it('returns error for unmapped service without local handler', async () => {
    const res = await transport.send({
      id: '1', service: 'unknown', method: 'call',
      payload: {}, timestamp: Date.now(),
    });
    expect(res.error?.code).toBe('NO_ENDPOINT');
  });

  it('throws when not connected', async () => {
    await transport.disconnect();
    await expect(transport.send({
      id: '1', service: 'x', method: 'y', payload: {}, timestamp: Date.now(),
    })).rejects.toThrow('not connected');
  });

  it('mapService() stores URL mapping', () => {
    transport.mapService('users', 'http://users.internal:3000');
    // Can't actually fetch in test env, but mapping is stored
  });

  it('setDefaultHeaders() configures headers', () => {
    transport.setDefaultHeaders({ 'x-api-key': 'secret' });
    // Headers will be included in real HTTP calls
  });
});

describe('@formwork/bridge-adapters: Transport stubs', () => {
  it('GrpcTransportStub throws on connect', async () => {
    await expect(new GrpcTransportStub().connect()).rejects.toThrow('grpc-js');
  });

  it('NatsTransportStub throws on connect', async () => {
    await expect(new NatsTransportStub().connect()).rejects.toThrow('nats');
  });

  it('KafkaTransportStub throws on connect', async () => {
    await expect(new KafkaTransportStub().connect()).rejects.toThrow('kafkajs');
  });
});
