/**
 * @module @formwork/bridge
 * @description Transport implementations (InMemory + HTTP)
 * @patterns Strategy (ITransport), Adapter (HttpTransport wraps fetch)
 */

import { BridgeTransportNotConnectedError } from "./exceptions/transport.js";
import type { BridgeMessage, BridgeResponse, ITransport } from "./types.js";

/**
 * In-process `ITransport` for tests — routes `send` to `onRequest` handlers.
 *
 * @example
 * ```ts
 * import { InMemoryTransport } from '@formwork/bridge';
 * const t = new InMemoryTransport();
 * await t.connect();
 * ```
 */
export class InMemoryTransport implements ITransport {
  readonly name = "memory";
  private handlers = new Map<string, (msg: BridgeMessage) => Promise<BridgeResponse>>();
  private sentMessages: BridgeMessage[] = [];
  private connected = false;
  private latencyMs = 0;

  /** Simulate network latency */
  /**
   * @param {number} ms
   */
  setLatency(ms: number): void {
    this.latencyMs = ms;
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
      throw new BridgeTransportNotConnectedError(this.name, "Transport not connected.");
    this.sentMessages.push(message as BridgeMessage);

    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }

    const handler = this.handlers.get(message.service);
    if (!handler) {
      return {
        id: message.id,
        payload: null as Res,
        error: {
          code: "SERVICE_NOT_FOUND",
          message: `Service "${message.service}" not registered.`,
        },
        durationMs: 0,
      };
    }

    const start = Date.now();
    try {
      const response = await handler(message as BridgeMessage);
      return { ...response, durationMs: Date.now() - start } as BridgeResponse<Res>;
    } catch (error) {
      return {
        id: message.id,
        payload: null as Res,
        error: { code: "INTERNAL_ERROR", message: (error as Error).message },
        durationMs: Date.now() - start,
      };
    }
  }

  // ── Test helpers ──────────────────────────────────────

  getSent(): BridgeMessage[] {
    return [...this.sentMessages];
  }
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * @param {string} service
   * @param {string} [method]
   */
  assertSent(service: string, method?: string): void {
    const match = this.sentMessages.some(
      (m) => m.service === service && (method === undefined || m.method === method),
    );
    if (!match)
      throw new Error(
        `Expected message to service "${service}"${method ? `.${method}` : ""}, but none found.`,
      );
  }

  /**
   * @param {number} count
   */
  assertSentCount(count: number): void {
    if (this.sentMessages.length !== count) {
      throw new Error(`Expected ${count} messages sent, got ${this.sentMessages.length}.`);
    }
  }

  reset(): void {
    this.sentMessages = [];
    this.handlers.clear();
  }
}

// ── Service Endpoint ──────────────────────────────────────
