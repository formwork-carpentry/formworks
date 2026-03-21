/**
 * @module @formwork/http
 * @description HTTP/3 (QUIC) server stub — planned for v1.1.
 *
 * Node.js QUIC/HTTP3 APIs are experimental (--experimental-quic).
 * This stub provides the interface so apps can opt-in when Node.js stabilises.
 *
 * @example
 * ```ts
 * import { serveHttp3 } from '@formwork/http';
 *
 * // When Node.js QUIC is stable:
 * serveHttp3(kernel, {
 *   port: 443,
 *   cert: './certs/cert.pem',
 *   key: './certs/key.pem',
 * });
 * ```
 */

import type { HttpKernel } from "../kernel/HttpKernel.js";

/**
 * Options for the HTTP/3 server.
 */
export interface Http3Options {
  /** Port to listen on (default: 443) */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Path to TLS certificate file (PEM) */
  cert: string;
  /** Path to TLS private key file (PEM) */
  key: string;
  /** ALPN protocols (default: ['h3']) */
  alpnProtocols?: string[];
  /** Called when server is listening */
  onReady?: (address: { port: number; host: string; protocol: "h3" }) => void;
}

/**
 * Start an HTTP/3 (QUIC) server. **Not yet implemented.**
 *
 * This is a placeholder for when Node.js ships stable QUIC APIs.
 * Currently throws with a descriptive error message.
 *
 * @param {HttpKernel} _kernel - The application HTTP kernel
 * @param {Http3Options} _options - Server options including TLS certs
 * @throws {Error} Always — HTTP/3 is not yet available
 */
export function serveHttp3(_kernel: HttpKernel, _options: Http3Options): never {
  throw new Error(
    "HTTP/3 (QUIC) is not yet available in Carpenter.\n" +
      "Node.js QUIC APIs are experimental and require --experimental-quic.\n" +
      "This feature is planned for Carpenter v1.1.\n\n" +
      "For now, use HTTP/2 via a reverse proxy (nginx, Caddy) in front of serve().",
  );
}

/**
 * Check if the current Node.js runtime supports QUIC/HTTP3.
 *
 * @returns {{ supported: boolean; reason?: string }}
 */
export function checkHttp3Support(): { supported: boolean; reason?: string } {
  try {
    // Node.js experimental QUIC is behind a flag; check if the binding exists
    const nodeVersion = process.versions.node.split(".").map(Number);
    if ((nodeVersion[0] ?? 0) < 23) {
      return {
        supported: false,
        reason: `Node.js ${process.versions.node} — QUIC requires Node.js ≥23 with --experimental-quic`,
      };
    }
    return { supported: false, reason: "QUIC APIs are experimental — awaiting stabilisation" };
  } catch {
    return { supported: false, reason: "Unable to detect QUIC support" };
  }
}
