/**
 * @module @carpentry/bridge
 * @description RemoteService — typed RPC client with timeout and tracing
 * @patterns Proxy (intercepts method calls)
 */

import { RemoteServiceError } from "./exceptions/RemoteServiceError.js";
import type { BridgeMessage, BridgeResponse, ITransport } from "./types.js";

let idCounter = 0;

export interface CallOptions {
  timeout?: number;
  headers?: Record<string, string>;
  traceId?: string;
}

/**
 * RemoteService — typed RPC client for a single logical service name.
 *
 * It builds a {@link BridgeMessage} and delegates transport execution to an
 * {@link ITransport}. If the transport returns an error, this client throws
 * a {@link RemoteServiceError}.
 *
 * @example
 * ```ts
 * import { InMemoryTransport, RemoteService } from '@carpentry/bridge';
 *
 * const transport = new InMemoryTransport();
 * await transport.connect();
 *
 * transport.onRequest('users', async (msg) => ({
 *   id: msg.id,
 *   payload: { ok: true, received: msg.payload },
 *   durationMs: 0,
 * }));
 *
 * const remote = new RemoteService('users', transport);
 * const res = await remote.call('get', { id: 1 }, { timeout: 1_000 });
 * // res === { ok: true, received: { id: 1 } }
 * ```
 */
export class RemoteService {
  constructor(
    private serviceName: string,
    private transport: ITransport,
  ) {}

  /** Call a remote method */
  /**
   * @param {string} method
   * @param {Req} payload
   * @param {CallOptions} [options]
   * @returns {Promise<Res>}
   */
  async call<Req, Res>(method: string, payload: Req, options?: CallOptions): Promise<Res> {
    const message: BridgeMessage<Req> = {
      id: `msg-${++idCounter}-${Date.now().toString(36)}`,
      service: this.serviceName,
      method,
      payload,
      headers: options?.headers,
      traceId: options?.traceId,
      timestamp: Date.now(),
    };

    const timeoutMs = options?.timeout ?? 30000;
    const response = await Promise.race([
      this.transport.send<Req, Res>(message),
      this.timeoutPromise<Res>(timeoutMs, message.id),
    ]);

    if (response.error) {
      throw new RemoteServiceError(
        response.error.message,
        response.error.code,
        this.serviceName,
        method,
        response.error.details,
      );
    }

    return response.payload;
  }

  private timeoutPromise<T>(ms: number, _id: string): Promise<BridgeResponse<T>> {
    return new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new RemoteServiceError(
              `Request timed out after ${ms}ms`,
              "TIMEOUT",
              this.serviceName,
              "",
            ),
          ),
        ms,
      ),
    );
  }
}

// ── Health Check ──────────────────────────────────────────

export interface HealthStatus {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  checkedAt: Date;
  details?: Record<string, unknown>;
}
