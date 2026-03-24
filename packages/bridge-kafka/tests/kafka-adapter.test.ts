import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KafkaTransport, KafkaBridgeServer } from '../src/index.js';

function createMockKafkaDriver() {
  const mockAdmin = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    createTopics: vi.fn().mockResolvedValue(undefined),
  };
  const mockProducer = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
  };
  const groupJoinListeners: Array<() => void> = [];
  const fetchStartListeners: Array<() => void> = [];
  const mockConsumer = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockImplementation(async () => {
      // Fire ready events
      for (const listener of groupJoinListeners) listener();
      for (const listener of fetchStartListeners) listener();
    }),
    events: { GROUP_JOIN: 'consumer.group_join', FETCH_START: 'consumer.fetch_start', CRASH: 'consumer.crash' },
    on: vi.fn().mockImplementation((event: string, callback: () => void) => {
      if (event === 'consumer.group_join') groupJoinListeners.push(callback);
      if (event === 'consumer.fetch_start') fetchStartListeners.push(callback);
      return vi.fn(); // unsubscribe function
    }),
  };
  const mockKafka = {
    admin: vi.fn().mockReturnValue(mockAdmin),
    producer: vi.fn().mockReturnValue(mockProducer),
    consumer: vi.fn().mockReturnValue(mockConsumer),
  };
  function Kafka() { return mockKafka; }
  return {
    Kafka: Kafka as unknown as new (config: Record<string, unknown>) => typeof mockKafka,
    _admin: mockAdmin,
    _producer: mockProducer,
    _consumer: mockConsumer,
    _kafka: mockKafka,
  };
}

describe('KafkaTransport', () => {
  let driver: ReturnType<typeof createMockKafkaDriver>;
  let transport: KafkaTransport;

  beforeEach(() => {
    driver = createMockKafkaDriver();
    transport = new KafkaTransport(
      { brokers: ['localhost:9092'], clientId: 'test-client', startupDelayMs: 0, requestTimeoutMs: 50 },
      { driverLoader: vi.fn().mockResolvedValue(driver) },
    );
  });

  it('should connect successfully', async () => {
    await transport.connect();
    expect(transport.isConnected()).toBe(true);
    expect(driver._admin.createTopics).toHaveBeenCalled();
    expect(driver._producer.connect).toHaveBeenCalled();
    expect(driver._consumer.connect).toHaveBeenCalled();
  });

  it('should disconnect', async () => {
    await transport.connect();
    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);
    expect(driver._consumer.stop).toHaveBeenCalled();
    expect(driver._consumer.disconnect).toHaveBeenCalled();
    expect(driver._producer.disconnect).toHaveBeenCalled();
  });

  it('should send a message via producer', async () => {
    await transport.connect();
    // send will create a pending promise that times out, but producer.send should be called
    const sendPromise = transport.send({
      id: 'msg-1', service: 'UserService', method: 'getUser', payload: { id: 1 }, timestamp: Date.now(),
    });
    // Verify producer.send was called
    expect(driver._producer.send).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'carpenter.bridge.requests' }),
    );
    // Let the timeout expire (the transport config has a short timeout)
    const result = await sendPromise;
    expect(result.error).toBeDefined();
  });

  it('should throw when sending without connection', async () => {
    await expect(transport.send({
      id: 'x', service: 'Test', method: 'test', payload: {}, timestamp: Date.now(),
    })).rejects.toThrow('not connected');
  });
});

describe('KafkaBridgeServer', () => {
  let driver: ReturnType<typeof createMockKafkaDriver>;
  let server: KafkaBridgeServer;

  beforeEach(() => {
    driver = createMockKafkaDriver();
    server = new KafkaBridgeServer(
      { brokers: ['localhost:9092'], clientId: 'test-server', startupDelayMs: 0 },
      { driverLoader: vi.fn().mockResolvedValue(driver) },
    );
  });

  it('should connect successfully', async () => {
    await server.connect();
    expect(server.isConnected()).toBe(true);
    expect(driver._consumer.subscribe).toHaveBeenCalled();
    expect(driver._consumer.run).toHaveBeenCalled();
  });

  it('should register request handlers', () => {
    server.onRequest('UserService', async () => ({ data: { user: 'Alice' } }));
    // No error
  });

  it('should disconnect', async () => {
    await server.connect();
    await server.disconnect();
    expect(server.isConnected()).toBe(false);
  });
});
