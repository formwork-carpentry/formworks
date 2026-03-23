/**
 * @module @carpentry/bridge
 * @description Bridge types and transport interface
 */

/**
 * @module @carpentry/bridge
 * @description Polyglot bridge — unified RPC across transports (gRPC, NATS, Kafka, HTTP)
 *
 * Architecture:
 *   ServiceRegistry maps service names to transport endpoints
 *   ITransport abstracts the wire protocol (gRPC, NATS, Kafka, HTTP)
 *   RemoteService provides a typed RPC client with timeout, retry, tracing
 *   InMemoryTransport enables full testing without running external services
 *
 * @patterns Strategy (transports), Proxy (RemoteService), Registry (service discovery),
 *           Adapter (normalize gRPC/NATS/Kafka/HTTP into common message shape)
 * @principles OCP — new transports without modifying core; DIP — app depends on ITransport
 */

// ── Message Shape ─────────────────────────────────────────

export interface BridgeMessage<T = unknown> {
  id: string;
  service: string;
  method: string;
  payload: T;
  headers?: Record<string, string>;
  traceId?: string;
  timestamp: number;
}

export interface BridgeResponse<T = unknown> {
  id: string;
  payload: T;
  error?: { code: string; message: string; details?: unknown };
  durationMs: number;
}

// ── Transport Interface ───────────────────────────────────

export interface ITransport {
  readonly name: string;
  /** Send a request and await response */
  /**
   * @param {BridgeMessage<Req>} message
   * @returns {Promise<BridgeResponse<Res>>}
   */
  send<Req, Res>(message: BridgeMessage<Req>): Promise<BridgeResponse<Res>>;
  /** Subscribe to incoming requests (for service-side handling) */
  /**
   * @param {string} service
   * @param {(msg: BridgeMessage} handler
   */
  onRequest(service: string, handler: (msg: BridgeMessage) => Promise<BridgeResponse>): void;
  /** Connect to the transport */
  connect(): Promise<void>;
  /** Disconnect */
  disconnect(): Promise<void>;
}

// ── InMemoryTransport — for testing ───────────────────────
