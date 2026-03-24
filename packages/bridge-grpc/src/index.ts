/**
 * @module @carpentry/bridge-grpc
 * @description gRPC-backed bridge transport and responder implementations.
 *
 * @patterns Adapter (normalizes grpc-js to bridge contracts),
 *           Proxy (client-side unary bridge invocation)
 * @principles DIP - bridge clients and responders depend on contracts, not grpc-js
 */
import type { BridgeMessage, BridgeResponse, ITransport } from '@carpentry/core/contracts';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface GrpcTransportConfig {
  /** gRPC target in host:port format. */
  target: string;
  /** Time to wait for the channel to be ready (ms). */
  waitForReadyMs?: number;
  /** gRPC channel options. */
  channelOptions?: Record<string, unknown>;
  /** gRPC call options. */
  callOptions?: Record<string, unknown>;
}

export interface GrpcBridgeServerConfig {
  host?: string;
  port?: number;
}

export interface GrpcTransportDependencies {
  driverLoader?: () => Promise<GrpcDriverModule>;
}

export type TransportRequestHandler = (request: BridgeMessage) => Promise<BridgeResponse>;

interface GrpcDriverModule {
  Client: new (target: string, credentials: unknown, options?: Record<string, unknown>) => GrpcClient;
  Server: new () => GrpcServer;
  Metadata: new () => GrpcMetadata;
  credentials: { createInsecure(): unknown };
  ServerCredentials: { createInsecure(): unknown };
}

interface GrpcClient {
  makeUnaryRequest(
    method: string,
    serialize: (value: unknown) => Buffer,
    deserialize: (value: Buffer) => unknown,
    argument: unknown,
    metadata: GrpcMetadata,
    options: Record<string, unknown>,
    callback: (error: Error | null, value?: unknown) => void,
  ): void;
  waitForReady(deadline: number, callback: (error?: Error) => void): void;
  close(): void;
}

interface GrpcServer {
  addService(definition: Record<string, unknown>, implementation: Record<string, unknown>): void;
  bindAsync(address: string, credentials: unknown, callback: (error: Error | null, port: number) => void): void;
  start(): void;
  tryShutdown(callback: (error?: Error) => void): void;
}

interface GrpcMetadata {
  set(key: string, value: string): void;
}

/* ------------------------------------------------------------------ */
/*  Transport                                                         */
/* ------------------------------------------------------------------ */

/** gRPC unary bridge transport for Carpenter clients. */
export class GrpcTransport implements ITransport {
  readonly name = 'grpc';
  private readonly config: GrpcTransportConfig;
  private readonly driverLoader: () => Promise<GrpcDriverModule>;
  private client: GrpcClient | null = null;
  private metadataFactory: (() => GrpcMetadata) | null = null;
  private connected = false;

  constructor(config: GrpcTransportConfig, dependencies: GrpcTransportDependencies = {}) {
    this.config = config;
    this.driverLoader = dependencies.driverLoader ?? loadGrpcDriver;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) return;
    const driver = await this.driverLoader();
    this.client = new driver.Client(this.config.target, driver.credentials.createInsecure(), this.config.channelOptions);
    this.metadataFactory = () => new driver.Metadata();
    await waitForReady(this.client, this.config.waitForReadyMs ?? 5000);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    this.metadataFactory = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  async send<Req, Res>(message: BridgeMessage<Req>): Promise<BridgeResponse<Res>> {
    const client = this.requireClient();
    const metadata = this.createMetadata(message);
    try {
      const response = await new Promise<BridgeResponse<Res>>((resolve, reject) => {
        client.makeUnaryRequest(
          BRIDGE_METHOD_PATH,
          serializeJson,
          deserializeJson,
          message,
          metadata,
          this.config.callOptions ?? {},
          (error: Error | null, value?: unknown) => {
            if (error) { reject(error); return; }
            resolve(value as BridgeResponse<Res>);
          },
        );
      });
      return response;
    } catch (error) {
      return {
        data: undefined,
        error: normalizeTransportError(error),
      } as BridgeResponse<Res>;
    }
  }

  private createMetadata(message: BridgeMessage): GrpcMetadata {
    if (!this.metadataFactory) throw new Error('GrpcTransport not connected.');
    const metadata = this.metadataFactory();
    for (const [key, value] of Object.entries(message.headers ?? {})) {
      metadata.set(key, value);
    }
    if (message.traceId) {
      metadata.set('x-trace-id', message.traceId);
    }
    return metadata;
  }

  private requireClient(): GrpcClient {
    if (!this.isConnected() || !this.client) throw new Error('GrpcTransport not connected.');
    return this.client;
  }
}

/* ------------------------------------------------------------------ */
/*  Bridge Server                                                     */
/* ------------------------------------------------------------------ */

/** gRPC unary bridge responder that hosts Carpenter service handlers. */
export class GrpcBridgeServer {
  readonly name = 'grpc';
  private readonly driverLoader: () => Promise<GrpcDriverModule>;
  private handlers = new Map<string, TransportRequestHandler>();
  private server: GrpcServer | null = null;
  private connected = false;
  private host: string;
  private boundPort: number;

  constructor(config: GrpcBridgeServerConfig = {}, dependencies: GrpcTransportDependencies = {}) {
    this.driverLoader = dependencies.driverLoader ?? loadGrpcDriver;
    this.host = config.host ?? '127.0.0.1';
    this.boundPort = config.port ?? 50051;
  }

  onRequest(service: string, handler: TransportRequestHandler): void {
    this.handlers.set(service, handler);
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const driver = await this.driverLoader();
    const server = new driver.Server();
    server.addService(BRIDGE_SERVICE_DEFINITION, {
      callBridge: (call: { request: BridgeMessage }, callback: (error: null, response: BridgeResponse) => void) => {
        void this.handleUnaryCall(call, callback);
      },
    });
    this.boundPort = await bindServer(server, `${this.host}:${this.boundPort}`, driver.ServerCredentials.createInsecure());
    server.start();
    this.server = server;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.server) { this.connected = false; return; }
    await shutdownServer(this.server);
    this.server = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.server !== null;
  }

  getTarget(): string {
    return `${this.host}:${this.boundPort}`;
  }

  private async handleUnaryCall(
    call: { request: BridgeMessage },
    callback: (error: null, response: BridgeResponse) => void,
  ): Promise<void> {
    const request = call.request;
    const handler = this.handlers.get(request.service);
    const response = await invokeHandler(handler, request);
    callback(null, response);
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function invokeHandler(handler: TransportRequestHandler | undefined, request: BridgeMessage): Promise<BridgeResponse> {
  if (!handler) {
    return {
      error: { code: 'SERVICE_NOT_FOUND', message: `Service "${request.service}" not registered.` },
    };
  }
  try {
    return await handler(request);
  } catch (error) {
    return { error: normalizeTransportError(error) };
  }
}

function waitForReady(client: GrpcClient, waitForReadyMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    client.waitForReady(Date.now() + waitForReadyMs, (error?: Error) => {
      if (error) { reject(error); return; }
      resolve();
    });
  });
}

function bindServer(server: GrpcServer, address: string, credentials: unknown): Promise<number> {
  return new Promise((resolve, reject) => {
    server.bindAsync(address, credentials, (error: Error | null, port: number) => {
      if (error) { reject(error); return; }
      resolve(port);
    });
  });
}

function shutdownServer(server: GrpcServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.tryShutdown((error?: Error) => {
      if (error) { reject(error); return; }
      resolve();
    });
  });
}

function normalizeTransportError(error: unknown): { code: string; message: string } {
  return {
    code: 'GRPC_ERROR',
    message: error instanceof Error ? error.message : 'Unknown gRPC error',
  };
}

function serializeJson(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), 'utf8');
}

function deserializeJson(value: Buffer): unknown {
  return JSON.parse(value.toString('utf8'));
}

async function loadGrpcDriver(): Promise<GrpcDriverModule> {
  try {
    // @grpc/grpc-js is installed as a dev dependency and should be available at runtime
    return await import('@grpc/grpc-js') as unknown as GrpcDriverModule;
  } catch (error) {
    throw createMissingDriverError('@grpc/grpc-js', 'npm install @carpentry/bridge-grpc @grpc/grpc-js', error);
  }
}

function createMissingDriverError(packageName: string, installCommand: string, cause: unknown): Error {
  const error = new Error(`GrpcTransport requires "${packageName}". Install: ${installCommand}`);
  error.cause = cause;
  return error;
}

const BRIDGE_METHOD_PATH = '/carpenter.bridge.Bridge/Call';

const BRIDGE_SERVICE_DEFINITION = {
  callBridge: {
    path: BRIDGE_METHOD_PATH,
    requestStream: false,
    responseStream: false,
    requestSerialize: serializeJson,
    requestDeserialize: deserializeJson,
    responseSerialize: serializeJson,
    responseDeserialize: deserializeJson,
    originalName: 'Call',
  },
};

// ── Driver factory (Domain Factory Manager integration) ───

import type { CarpenterFactoryAdapter } from '@carpentry/core/adapters';

/**
 * BridgeManager-compatible driver factory for the gRPC transport.
 *
 * Config must include `target` (host:port).
 *
 * @example
 * ```ts
 * import { grpcDriverFactory } from '@carpentry/bridge-grpc';
 * bridgeManager.registerDriver('grpc', grpcDriverFactory);
 * ```
 */
export const grpcDriverFactory: CarpenterFactoryAdapter = (
  config: { driver: string; [key: string]: unknown },
) => new GrpcTransport(config as unknown as GrpcTransportConfig);
