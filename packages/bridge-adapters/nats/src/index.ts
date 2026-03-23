/**
 * @module @carpentry/bridge-nats
 * @description NATS-backed bridge transport and responder implementations.
 *
 * @patterns Adapter (normalizes NATS request/reply to bridge contracts),
 *           Strategy (driver loading and subject naming)
 * @principles DIP - bridge clients and responders depend on contracts, not the NATS SDK
 */
import type { BridgeMessage, BridgeResponse, ITransport } from '@carpentry/core/contracts';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface NatsBridgeConfig {
  server?: string;
  servers?: string[];
  subjectPrefix?: string;
  requestTimeoutMs?: number;
  queueGroup?: string;
}

export interface NatsTransportDependencies {
  connection?: NatsConnection;
  driverLoader?: () => Promise<NatsDriverModule>;
}

export type TransportRequestHandler = (request: BridgeMessage) => Promise<BridgeResponse>;

interface NatsDriverModule {
  connect(options?: Record<string, unknown>): Promise<NatsConnection>;
}

interface NatsConnection {
  request(subject: string, data: Uint8Array, options?: { timeout: number }): Promise<{ data: Uint8Array }>;
  subscribe(subject: string, options?: { queue?: string; callback: (error: Error | null, message: NatsMessage) => void }): NatsSubscription;
  publish(subject: string, data: Uint8Array): void;
  drain(): Promise<void>;
  isClosed(): boolean;
}

interface NatsMessage {
  data: Uint8Array;
  reply?: string;
}

interface NatsSubscription {
  unsubscribe(): void;
}

/* ------------------------------------------------------------------ */
/*  Transport (Client)                                                */
/* ------------------------------------------------------------------ */

/** NATS request/reply transport for Carpenter bridge clients. */
export class NatsTransport implements ITransport {
  readonly name = 'nats';
  private readonly config: NatsBridgeConfig;
  private connection: NatsConnection | null;
  private readonly ownsConnection: boolean;
  private readonly driverLoader: () => Promise<NatsDriverModule>;
  private connected: boolean;

  constructor(config: NatsBridgeConfig = {}, dependencies: NatsTransportDependencies = {}) {
    this.config = config;
    this.connection = dependencies.connection ?? null;
    this.ownsConnection = dependencies.connection === undefined;
    this.driverLoader = dependencies.driverLoader ?? loadNatsDriver;
    this.connected = dependencies.connection !== undefined;
  }

  async connect(): Promise<void> {
    if (this.connection) { this.connected = true; return; }
    const driver = await this.driverLoader();
    this.connection = await driver.connect(createConnectionOptions(this.config));
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connection) { this.connected = false; return; }
    if (this.ownsConnection && !this.connection.isClosed()) {
      await this.connection.drain();
    }
    this.connection = this.ownsConnection ? null : this.connection;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.connection !== null && !this.connection.isClosed();
  }

  async send<Req, Res>(message: BridgeMessage<Req>): Promise<BridgeResponse<Res>> {
    const connection = this.requireConnection();
    try {
      const responseMessage = await connection.request(
        createServiceSubject(this.config, message.service),
        encodeJson(message),
        { timeout: this.config.requestTimeoutMs ?? 5000 },
      );
      return decodeJson(responseMessage.data) as BridgeResponse<Res>;
    } catch (error) {
      return { error: normalizeTransportError(error) } as BridgeResponse<Res>;
    }
  }

  private requireConnection(): NatsConnection {
    if (!this.isConnected() || !this.connection) throw new Error('NatsTransport not connected.');
    return this.connection;
  }
}

/* ------------------------------------------------------------------ */
/*  Bridge Server                                                     */
/* ------------------------------------------------------------------ */

/** NATS responder that binds Carpenter bridge handlers to service subjects. */
export class NatsBridgeServer {
  readonly name = 'nats';
  private readonly config: NatsBridgeConfig;
  private connection: NatsConnection | null;
  private readonly ownsConnection: boolean;
  private readonly driverLoader: () => Promise<NatsDriverModule>;
  private handlers = new Map<string, TransportRequestHandler>();
  private subscriptions = new Map<string, NatsSubscription>();
  private connected: boolean;

  constructor(config: NatsBridgeConfig = {}, dependencies: NatsTransportDependencies = {}) {
    this.config = config;
    this.connection = dependencies.connection ?? null;
    this.ownsConnection = dependencies.connection === undefined;
    this.driverLoader = dependencies.driverLoader ?? loadNatsDriver;
    this.connected = dependencies.connection !== undefined;
  }

  onRequest(service: string, handler: TransportRequestHandler): void {
    this.handlers.set(service, handler);
    if (this.isConnected() && !this.subscriptions.has(service)) {
      this.subscribeToService(service);
    }
  }

  async connect(): Promise<void> {
    if (this.connection) {
      this.connected = true;
      this.subscribeAll();
      return;
    }
    const driver = await this.driverLoader();
    this.connection = await driver.connect(createConnectionOptions(this.config));
    this.connected = true;
    this.subscribeAll();
  }

  async disconnect(): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
    if (this.connection && this.ownsConnection && !this.connection.isClosed()) {
      await this.connection.drain();
    }
    this.connection = this.ownsConnection ? null : this.connection;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.connection !== null && !this.connection.isClosed();
  }

  private subscribeAll(): void {
    for (const service of this.handlers.keys()) {
      if (!this.subscriptions.has(service)) {
        this.subscribeToService(service);
      }
    }
  }

  private subscribeToService(service: string): void {
    const connection = this.requireConnection();
    const subject = createServiceSubject(this.config, service);
    const subscription = connection.subscribe(subject, {
      queue: this.config.queueGroup,
      callback: (error: Error | null, message: NatsMessage) => {
        void this.handleIncomingMessage(service, error, message);
      },
    });
    this.subscriptions.set(service, subscription);
  }

  private async handleIncomingMessage(service: string, error: Error | null, message: NatsMessage): Promise<void> {
    if (!message.reply) return;
    const connection = this.requireConnection();
    if (error) {
      connection.publish(message.reply, encodeJson(createFailureResponse('unknown', error)));
      return;
    }
    const request = decodeJson(message.data) as BridgeMessage;
    const handler = this.handlers.get(service);
    const response = await invokeHandler(handler, request);
    connection.publish(message.reply, encodeJson(response));
  }

  private requireConnection(): NatsConnection {
    if (!this.isConnected() || !this.connection) throw new Error('NatsBridgeServer not connected.');
    return this.connection;
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
    return createFailureResponse(request.id, error);
  }
}

function createFailureResponse(_id: string, error: unknown): BridgeResponse {
  return { error: normalizeTransportError(error) };
}

function createConnectionOptions(config: NatsBridgeConfig): Record<string, unknown> {
  return {
    servers: config.servers ?? (config.server ? [config.server] : undefined),
  };
}

function createServiceSubject(config: NatsBridgeConfig, service: string): string {
  return `${config.subjectPrefix ?? 'carpenter.bridge'}.${service}`;
}

function normalizeTransportError(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : 'Unknown NATS error';
  const code = extractErrorCode(error);
  if (code === '503' || message.toLowerCase().includes('no responders')) {
    return { code: 'SERVICE_UNAVAILABLE', message };
  }
  return { code: 'NATS_ERROR', message };
}

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeJson(value: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(value));
}

function decodeJson(value: Uint8Array): unknown {
  return JSON.parse(textDecoder.decode(value));
}

async function loadNatsDriver(): Promise<NatsDriverModule> {
  try {
    // nats is installed as a dev dependency and should be available at runtime
    return await import('nats') as unknown as NatsDriverModule;
  } catch (error) {
    throw createMissingDriverError('nats', 'npm install @carpentry/bridge-nats nats', error);
  }
}

function createMissingDriverError(packageName: string, installCommand: string, cause: unknown): Error {
  const error = new Error(`NatsTransport requires "${packageName}". Install: ${installCommand}`);
  error.cause = cause;
  return error;
}

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@carpentry/core/adapters';

/**
 * BridgeManager-compatible driver factory for the NATS transport.
 *
 * @example
 * ```ts
 * import { natsDriverFactory } from '@carpentry/bridge-nats';
 * bridgeManager.registerDriver('nats', natsDriverFactory);
 * ```
 */
export const natsDriverFactory: CarpenterFactoryAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new NatsTransport(config as unknown as NatsBridgeConfig);
