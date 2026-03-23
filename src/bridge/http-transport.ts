/**
 * @module @carpentry/bridge
 * @description HTTP-based RPC transport
 * @patterns Adapter (wraps fetch API)
 */

import { BridgeTransportNotConnectedError } from "./exceptions/transport.js";
import type { BridgeMessage, BridgeResponse, ITransport } from "./types.js";

/**
 * `ITransport` that POSTs bridge messages to `mapService` base URLs (or handles locally via `onRequest`).
 *
 * @example
 * ```ts
 * import { HttpTransport } from './';
 * const t = new HttpTransport();
 * t.mapService('users', 'https://users.internal/rpc');
 * ```
 */
export class HttpTransport implements ITransport {
  readonly name = "http";
  private baseUrls = new Map<string, string>();
  private connected = false;
  private handlers = new Map<string, (msg: BridgeMessage) => Promise<BridgeResponse>>();
  private defaultHeaders: Record<string, string> = {};

  /** Map service names to base URLs */
  /**
   * @param {string} service
   * @param {string} baseUrl
   * @returns {this}
   */
  mapService(service: string, baseUrl: string): this {
    this.baseUrls.set(service, baseUrl);
    return this;
  }

  /**
   * @param {Record<string, string>} headers
   * @returns {this}
   */
  setDefaultHeaders(headers: Record<string, string>): this {
    this.defaultHeaders = headers;
    return this;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * @param {string} service
   * @param {(msg: BridgeMessage} handler
   */
  onRequest(service: string, handler: (msg: BridgeMessage) => Promise<BridgeResponse>): void {
    this.handlers.set(service, handler);
  }

  /**
   * @param {BridgeMessage<Req>} message
   * @returns {Promise<BridgeResponse<Res>>}
   */
  async send<Req, Res>(message: BridgeMessage<Req>): Promise<BridgeResponse<Res>> {
    if (!this.connected)
      throw new BridgeTransportNotConnectedError(this.name, "HttpTransport not connected.");

    const localHandler = this.handlers.get(message.service);
    if (localHandler) return this.handleLocal<Req, Res>(message, localHandler);

    const baseUrl = this.baseUrls.get(message.service);
    if (!baseUrl) {
      return {
        id: message.id,
        payload: null as Res,
        error: { code: "NO_ENDPOINT", message: `No URL mapped for service "${message.service}".` },
        durationMs: 0,
      };
    }

    return this.httpCall<Req, Res>(message, baseUrl);
  }

  private async handleLocal<Req, Res>(
    message: BridgeMessage<Req>,
    handler: (msg: BridgeMessage) => Promise<BridgeResponse>,
  ): Promise<BridgeResponse<Res>> {
    const start = Date.now();
    const result = await handler(message as BridgeMessage);
    return { ...result, durationMs: Date.now() - start } as BridgeResponse<Res>;
  }

  private async httpCall<Req, Res>(
    message: BridgeMessage<Req>,
    baseUrl: string,
  ): Promise<BridgeResponse<Res>> {
    const start = Date.now();
    try {
      const response = await fetch(`${baseUrl}/${message.method}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.defaultHeaders,
          ...message.headers,
          ...(message.traceId ? { "x-trace-id": message.traceId } : {}),
        },
        body: JSON.stringify({ id: message.id, payload: message.payload }),
      });
      const data = (await response.json()) as {
        payload: Res;
        error?: { code: string; message: string };
      };
      return { id: message.id, ...data, durationMs: Date.now() - start };
    } catch (error) {
      return {
        id: message.id,
        payload: null as Res,
        error: { code: "HTTP_ERROR", message: (error as Error).message },
        durationMs: Date.now() - start,
      };
    }
  }
}

// ── Transport Stubs ───────────────────────────────────────
