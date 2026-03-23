/**
 * @module @carpentry/core/contracts/bridge
 * @description Microservice bridge contracts - transport, service registry, health checking.
 *
 * Implementations: InMemoryTransport, HttpTransport, GrpcTransportStub, ServiceRegistry
 *
 * @example
 * ```ts
 * const service = new RemoteService('users', transport, { timeoutMs: 5000 });
 * const user = await service.call<Request, Response>('getUser', { id: 42 });
 * ```
 */

/** @typedef {Object} BridgeMessage - RPC message sent between services */
export interface BridgeMessage<T = unknown> {
  /** @property {string} id - Unique message identifier */
  id: string;
  /** @property {string} service - Target service name */
  service: string;
  /** @property {string} method - Method to call on the service */
  method: string;
  /** @property {T} payload - Request data */
  payload: T;
  /** @property {Record<string, string>} [headers] - Custom headers */
  headers?: Record<string, string>;
  /** @property {string} [traceId] - Distributed tracing ID */
  traceId?: string;
  /** @property {number} timestamp - Message creation timestamp */
  timestamp: number;
}

/** @typedef {Object} BridgeResponse - RPC response from a service */
export interface BridgeResponse<T = unknown> {
  /** @property {T} [data] - Response data (on success) */
  data?: T;
  /** @property {Object} [error] - Error details (on failure) */
  error?: { code: string; message: string };
}

/** @typedef {Object} ITransport - Service communication transport contract */
export interface ITransport {
  /**
   * Send a message and wait for a response.
   * @param {BridgeMessage<Req>} message - Outgoing RPC message
   * @returns {Promise<BridgeResponse<Res>>} Service response
   */
  send<Req, Res>(message: BridgeMessage<Req>): Promise<BridgeResponse<Res>>;

  /**
   * Connect to the transport (open socket, establish channel).
   * @returns {Promise<void>}
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the transport.
   * @returns {Promise<void>}
   */
  disconnect(): Promise<void>;

  /**
   * Check if the transport is connected.
   * @returns {boolean}
   */
  isConnected(): boolean;
}

/** @typedef {Object} ServiceEndpoint - A registered service instance */
export interface ServiceEndpoint {
  /** @property {string} host - Service hostname or IP */
  host: string;
  /** @property {number} port - Service port */
  port: number;
  /** @property {number} [weight] - Load balancing weight */
  weight?: number;
  /** @property {boolean} [healthy] - Health status */
  healthy?: boolean;
}
