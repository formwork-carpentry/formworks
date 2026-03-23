/**
 * @module @carpentry/bridge
 * @description Unix socket transport — ultra-low-latency IPC for same-machine services.
 *
 * Uses node:net to create a Unix domain socket connection with JSON-RPC messaging.
 * Typical latency: <0.1ms (vs ~1ms for HTTP localhost, ~5ms for gRPC).
 *
 * @example
 * ```ts
 * // Server side:
 * const server = createUnixSocketServer('/tmp/carpenter-users.sock', async (msg) => {
 *   if (msg.method === 'getUser') return { data: { id: msg.payload.id, name: 'Alice' } };
 *   return { error: { code: 'NOT_FOUND', message: 'Unknown method' } };
 * });
 *
 * // Client side:
 * const transport = new UnixSocketTransport('/tmp/carpenter-users.sock');
 * await transport.connect();
 * const response = await transport.send({ id: '1', service: 'users', method: 'getUser', payload: { id: 42 }, timestamp: Date.now() });
 * console.log(response.data); // { id: 42, name: 'Alice' }
 * ```
 */

import { unlinkSync as fsUnlink } from "node:fs";
import { type Server, type Socket, createConnection, createServer } from "node:net";
import type { BridgeMessage, BridgeResponse, ITransport } from "@carpentry/core/contracts";
import { BridgeTimeoutError, BridgeTransportNotConnectedError } from "./exceptions/transport.js";

/**
 * Unix socket transport — connects to a service via Unix domain socket.
 */
export class UnixSocketTransport implements ITransport {
  private socket: Socket | null = null;
  private connected = false;
  private pending = new Map<
    string,
    { resolve: (v: BridgeResponse) => void; reject: (e: Error) => void }
  >();
  private buffer = "";

  /**
   * @param {string} socketPath - Path to the Unix domain socket (e.g., '/tmp/my-service.sock')
   * @param {number} [timeoutMs=5000] - Request timeout in milliseconds
   */
  constructor(
    private socketPath: string,
    private timeoutMs = 5000,
  ) {}

  /**
   * Connect to the Unix socket.
   * @returns {Promise<void>}
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = createConnection({ path: this.socketPath }, () => {
        this.connected = true;
        resolve();
      });
      this.socket.on("error", (err) => {
        if (!this.connected) reject(err);
      });
      this.socket.on("data", (data) => this.onData(data.toString()));
      this.socket.on("close", () => {
        this.connected = false;
      });
    });
  }

  /**
   * Disconnect from the Unix socket.
   * @returns {Promise<void>}
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();
        return;
      }
      this.socket.end(() => {
        this.connected = false;
        this.socket = null;
        resolve();
      });
    });
  }

  /**
   * Check if connected.
   * @returns {boolean}
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send a message and wait for a response.
   * @param {BridgeMessage<Req>} message - RPC message
   * @returns {Promise<BridgeResponse<Res>>}
   */
  async send<Req, Res>(message: BridgeMessage<Req>): Promise<BridgeResponse<Res>> {
    if (!this.socket || !this.connected) {
      throw new BridgeTransportNotConnectedError(
        "unix-socket",
        `Not connected to ${this.socketPath}`,
        {
          socketPath: this.socketPath,
        },
      );
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(message.id);
        reject(new BridgeTimeoutError(this.timeoutMs, this.socketPath));
      }, this.timeoutMs);

      this.pending.set(message.id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v as BridgeResponse<Res>);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });

      this.socket?.write(`${JSON.stringify(message)}\n`);
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as BridgeResponse & { id?: string };
        const id = msg.id ?? "";
        const pending = this.pending.get(id);
        if (pending) {
          this.pending.delete(id);
          pending.resolve(msg);
        }
      } catch {
        // Skip malformed messages
      }
    }
  }
}

/**
 * Create a Unix socket server that handles RPC messages.
 *
 * @param {string} socketPath - Path for the socket file
 * @param {Function} handler - Async function that processes messages and returns responses
 * @returns {Server} Node.js net.Server (call .close() to shut down)
 *
 * @example
 * ```ts
 * const server = createUnixSocketServer('/tmp/users.sock', async (msg) => {
 *   const users = { 1: 'Alice', 2: 'Bob' };
 *   return { data: { name: users[msg.payload.id] ?? 'Unknown' } };
 * });
 * ```
 */
export function createUnixSocketServer(
  socketPath: string,
  handler: (message: BridgeMessage) => Promise<BridgeResponse>,
): Server {
  const server = createServer((socket: Socket) => {
    let buffer = "";

    socket.on("data", async (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as BridgeMessage;
          const response = await handler(msg);
          socket.write(`${JSON.stringify({ ...response, id: msg.id })}\n`);
        } catch (err) {
          socket.write(
            `${JSON.stringify({ error: { code: "INTERNAL", message: (err as Error).message } })}\n`,
          );
        }
      }
    });
  });

  // Clean up stale socket file
  try {
    fsUnlink(socketPath);
  } catch {
    /* ignore */
  }

  server.listen(socketPath);
  return server;
}
