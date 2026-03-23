/**
 * @module @carpentry/bridge-kafka
 * @description Kafka-backed bridge transport and responder implementations.
 *
 * @patterns Adapter (normalizes Kafka request/reply to bridge contracts),
 *           Strategy (topic naming and broker configuration)
 * @principles DIP - bridge clients and responders depend on contracts, not the Kafka SDK
 */
import { randomUUID } from 'node:crypto';
import type { BridgeMessage, BridgeResponse, ITransport } from '@carpentry/core/contracts';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface KafkaBridgeConfig {
  brokers: string[];
  clientId?: string;
  requestTopic?: string;
  responseTopicPrefix?: string;
  consumerGroupId?: string;
  requestTimeoutMs?: number;
  startupDelayMs?: number;
  fromBeginning?: boolean;
  connectionTimeout?: number;
  authenticationTimeout?: number;
  reauthenticationThreshold?: number;
  ssl?: boolean | Record<string, unknown>;
  sasl?: Record<string, unknown>;
}

export interface KafkaTransportDependencies {
  driverLoader?: () => Promise<KafkaDriverModule>;
}

export type TransportRequestHandler = (request: BridgeMessage) => Promise<BridgeResponse>;

interface KafkaDriverModule {
  Kafka: new (config: Record<string, unknown>) => KafkaInstance;
}

interface KafkaInstance {
  admin(): KafkaAdmin;
  producer(): KafkaProducer;
  consumer(config: { groupId: string }): KafkaConsumer;
}

interface KafkaAdmin {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createTopics(config: { waitForLeaders: boolean; topics: Array<{ topic: string; numPartitions: number; replicationFactor: number }> }): Promise<void>;
}

interface KafkaProducer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(config: { topic: string; messages: Array<{ key?: string; value: Buffer; headers?: Record<string, string> }> }): Promise<void>;
}

interface KafkaConsumer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  stop(): Promise<void>;
  subscribe(config: { topic: string; fromBeginning?: boolean }): Promise<void>;
  run(config: { eachMessage: (payload: KafkaMessagePayload) => Promise<void> }): Promise<void>;
  events: { GROUP_JOIN: string; FETCH_START: string; CRASH: string };
  on(event: string, callback: (event?: { payload?: { error?: Error } }) => void): () => void;
}

interface KafkaMessagePayload {
  message: { key?: Buffer; value: Buffer | null; headers?: Record<string, string | Buffer | Array<string | Buffer>> };
}

/* ------------------------------------------------------------------ */
/*  Transport (Client)                                                */
/* ------------------------------------------------------------------ */

/** Kafka request/reply bridge transport for Carpenter clients. */
export class KafkaTransport implements ITransport {
  readonly name = 'kafka';
  private readonly config: KafkaBridgeConfig;
  private readonly driverLoader: () => Promise<KafkaDriverModule>;
  private readonly clientId: string;
  private readonly responseTopic: string;
  private producer: KafkaProducer | null = null;
  private consumer: KafkaConsumer | null = null;
  private connected = false;
  private pending = new Map<string, { timeout: ReturnType<typeof setTimeout>; resolve: (value: BridgeResponse) => void; reject: (error: Error) => void }>();

  constructor(config: KafkaBridgeConfig, dependencies: KafkaTransportDependencies = {}) {
    this.config = config;
    this.driverLoader = dependencies.driverLoader ?? loadKafkaDriver;
    this.clientId = config.clientId ?? createClientId('carpenter-bridge-kafka-client');
    this.responseTopic = `${config.responseTopicPrefix ?? 'carpenter.bridge.responses'}.${this.clientId}`;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const driver = await this.driverLoader();
    const kafka = new driver.Kafka(createKafkaClientConfig(this.config, this.clientId));
    const admin = kafka.admin();
    const producer = kafka.producer();
    const consumer = kafka.consumer({ groupId: this.config.consumerGroupId ?? `${this.clientId}.responses` });

    await admin.connect();
    await ensureTopics(admin, [this.responseTopic]);
    await admin.disconnect();

    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: this.responseTopic, fromBeginning: this.config.fromBeginning ?? false });

    const ready = waitForConsumerReady(consumer, 5000);
    void consumer.run({
      eachMessage: async (payload: KafkaMessagePayload) => { this.handleResponseMessage(payload); },
    });
    await ready;
    await delay(this.config.startupDelayMs ?? 250);

    this.producer = producer;
    this.consumer = consumer;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.rejectPending(new Error('KafkaTransport disconnected.'));
    if (this.consumer) { await this.consumer.stop(); await this.consumer.disconnect(); this.consumer = null; }
    if (this.producer) { await this.producer.disconnect(); this.producer = null; }
  }

  isConnected(): boolean {
    return this.connected && this.producer !== null && this.consumer !== null;
  }

  async send<Req, Res>(message: BridgeMessage<Req>): Promise<BridgeResponse<Res>> {
    const producer = this.requireProducer();
    const startedAt = Date.now();
    try {
      const response = this.waitForResponse<Res>(message.id, startedAt);
      await producer.send({
        topic: this.getRequestTopic(),
        messages: [{
          key: message.service,
          value: encodeJson(message),
          headers: createRequestHeaders(this.responseTopic, message),
        }],
      });
      return await response;
    } catch (error) {
      return { error: normalizeTransportError(error) } as BridgeResponse<Res>;
    }
  }

  private handleResponseMessage(payload: KafkaMessagePayload): void {
    if (!payload.message.value) return;
    const response = decodeJson(payload.message.value) as BridgeResponse & { id: string };
    const pending = this.pending.get(response.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.id);
    pending.resolve(response);
  }

  private waitForResponse<Res>(id: string, _startedAt: number): Promise<BridgeResponse<Res>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`KafkaTransport request timed out after ${this.config.requestTimeoutMs ?? 5000}ms.`));
      }, this.config.requestTimeoutMs ?? 5000);
      this.pending.set(id, {
        timeout,
        reject,
        resolve: (response) => resolve(response as BridgeResponse<Res>),
      });
    });
  }

  private rejectPending(error: Error): void {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private getRequestTopic(): string {
    return this.config.requestTopic ?? 'carpenter.bridge.requests';
  }

  private requireProducer(): KafkaProducer {
    if (!this.isConnected() || !this.producer) throw new Error('KafkaTransport not connected.');
    return this.producer;
  }
}

/* ------------------------------------------------------------------ */
/*  Bridge Server                                                     */
/* ------------------------------------------------------------------ */

/** Kafka responder that consumes bridge requests and publishes replies. */
export class KafkaBridgeServer {
  readonly name = 'kafka';
  private readonly config: KafkaBridgeConfig;
  private readonly driverLoader: () => Promise<KafkaDriverModule>;
  private readonly clientId: string;
  private producer: KafkaProducer | null = null;
  private consumer: KafkaConsumer | null = null;
  private connected = false;
  private handlers = new Map<string, TransportRequestHandler>();

  constructor(config: KafkaBridgeConfig, dependencies: KafkaTransportDependencies = {}) {
    this.config = config;
    this.driverLoader = dependencies.driverLoader ?? loadKafkaDriver;
    this.clientId = config.clientId ?? createClientId('carpenter-bridge-kafka-server');
  }

  onRequest(service: string, handler: TransportRequestHandler): void {
    this.handlers.set(service, handler);
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const driver = await this.driverLoader();
    const kafka = new driver.Kafka(createKafkaClientConfig(this.config, this.clientId));
    const admin = kafka.admin();
    const producer = kafka.producer();
    const consumer = kafka.consumer({ groupId: this.config.consumerGroupId ?? `${this.clientId}.servers` });

    await admin.connect();
    await ensureTopics(admin, [this.getRequestTopic()]);
    await admin.disconnect();

    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: this.getRequestTopic(), fromBeginning: this.config.fromBeginning ?? false });

    const ready = waitForConsumerReady(consumer, 5000);
    void consumer.run({
      eachMessage: async (payload: KafkaMessagePayload) => { await this.handleRequestMessage(producer, payload); },
    });
    await ready;
    await delay(this.config.startupDelayMs ?? 250);

    this.producer = producer;
    this.consumer = consumer;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.consumer) { await this.consumer.stop(); await this.consumer.disconnect(); this.consumer = null; }
    if (this.producer) { await this.producer.disconnect(); this.producer = null; }
  }

  isConnected(): boolean {
    return this.connected && this.producer !== null && this.consumer !== null;
  }

  private async handleRequestMessage(producer: KafkaProducer, payload: KafkaMessagePayload): Promise<void> {
    if (!payload.message.value) return;
    const request = decodeJson(payload.message.value) as BridgeMessage;
    const replyTopic = readHeader(payload.message.headers, 'x-reply-topic');
    if (!replyTopic) return;
    const handler = this.handlers.get(request.service);
    const response = await invokeHandler(handler, request);
    await producer.send({
      topic: replyTopic,
      messages: [{ key: request.id, value: encodeJson(response) }],
    });
  }

  private getRequestTopic(): string {
    return this.config.requestTopic ?? 'carpenter.bridge.requests';
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function invokeHandler(handler: TransportRequestHandler | undefined, request: BridgeMessage): Promise<BridgeResponse> {
  if (!handler) {
    return { error: { code: 'SERVICE_NOT_FOUND', message: `Service "${request.service}" not registered.` } };
  }
  try {
    return await handler(request);
  } catch (error) {
    return { error: normalizeTransportError(error) };
  }
}

async function ensureTopics(admin: KafkaAdmin, topics: string[]): Promise<void> {
  await admin.createTopics({
    waitForLeaders: true,
    topics: topics.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
  });
}

function createRequestHeaders(messageReplyTopic: string, message: BridgeMessage): Record<string, string> {
  return {
    'x-reply-topic': messageReplyTopic,
    'x-bridge-service': message.service,
    'x-bridge-method': message.method,
    ...(message.traceId ? { 'x-trace-id': message.traceId } : {}),
  };
}

function createKafkaClientConfig(config: KafkaBridgeConfig, clientId: string): Record<string, unknown> {
  return {
    brokers: config.brokers,
    clientId,
    connectionTimeout: config.connectionTimeout,
    authenticationTimeout: config.authenticationTimeout,
    reauthenticationThreshold: config.reauthenticationThreshold,
    ssl: config.ssl,
    sasl: config.sasl,
  };
}

function readHeader(headers: Record<string, string | Buffer | Array<string | Buffer>> | undefined, key: string): string | undefined {
  const value = headers?.[key];
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : first?.toString('utf8');
  }
  return undefined;
}

function waitForConsumerReady(consumer: KafkaConsumer, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let joined = false;
    let fetching = false;
    const maybeResolve = () => {
      if (!joined || !fetching) return;
      clearTimeout(timeout);
      onJoin(); onFetch(); onCrash();
      resolve();
    };
    const onJoin = consumer.on(consumer.events.GROUP_JOIN, () => { joined = true; maybeResolve(); });
    const onFetch = consumer.on(consumer.events.FETCH_START, () => { fetching = true; maybeResolve(); });
    const onCrash = consumer.on(consumer.events.CRASH, (event) => {
      clearTimeout(timeout); onJoin(); onFetch(); onCrash();
      const error = event?.payload?.error;
      reject(error instanceof Error ? error : new Error('Kafka consumer crashed during startup.'));
    });
    const timeout = setTimeout(() => {
      onJoin(); onFetch(); onCrash();
      reject(new Error(`Kafka consumer did not become ready within ${timeoutMs}ms.`));
    }, timeoutMs);
  });
}

function normalizeTransportError(error: unknown): { code: string; message: string } {
  return { code: 'KAFKA_ERROR', message: error instanceof Error ? error.message : 'Unknown Kafka error' };
}

function encodeJson(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), 'utf8');
}

function decodeJson(value: Buffer): unknown {
  return JSON.parse(value.toString('utf8'));
}

function createClientId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadKafkaDriver(): Promise<KafkaDriverModule> {
  try {
    // kafkajs is installed as a dev dependency and should be available at runtime
    return await import('kafkajs') as unknown as KafkaDriverModule;
  } catch (error) {
    throw createMissingDriverError('kafkajs', 'npm install @carpentry/bridge-kafka kafkajs', error);
  }
}

function createMissingDriverError(packageName: string, installCommand: string, cause: unknown): Error {
  const error = new Error(`KafkaTransport requires "${packageName}". Install: ${installCommand}`);
  error.cause = cause;
  return error;
}

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@carpentry/core/adapters';

/**
 * BridgeManager-compatible driver factory for the Kafka transport.
 *
 * Config must include `brokers` (string[]).
 *
 * @example
 * ```ts
 * import { kafkaDriverFactory } from '@carpentry/bridge-kafka';
 * bridgeManager.registerDriver('kafka', kafkaDriverFactory);
 * ```
 */
export const kafkaDriverFactory: CarpenterFactoryAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new KafkaTransport(config as unknown as KafkaBridgeConfig);
