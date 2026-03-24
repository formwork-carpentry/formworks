/**
 * @module @carpentry/core/contracts/edge
 * @description Edge runtime contracts - runtime detection and capabilities.
 *
 * Implementations: EdgeKernel, EdgeAdapter
 *
 * @example
 * ```ts
 * const runtime = detectRuntime();
 * if (runtime.capabilities.kv) {
 *   const kv = new CloudflareKV();
 * }
 * ```
 */

/** @typedef {'cloudflare-workers' | 'deno-deploy' | 'vercel-edge' | 'bun' | 'node'} EdgeRuntimeName */
export type EdgeRuntimeName = "cloudflare-workers" | "deno-deploy" | "vercel-edge" | "bun" | "node";

/** @typedef {Object} EdgeCapabilities - What the current runtime supports */
export interface EdgeCapabilities {
  /** @property {boolean} kv - Key-value storage available */
  kv: boolean;
  /** @property {boolean} durableObjects - Durable Objects (CF Workers) */
  durableObjects: boolean;
  /** @property {boolean} webSocket - WebSocket support */
  webSocket: boolean;
  /** @property {boolean} wasm - WebAssembly support */
  wasm: boolean;
  /** @property {number} maxMemoryMb - Maximum memory in MB */
  maxMemoryMb: number;
}

/** @typedef {Object} EdgeRequest - Lightweight edge request */
export interface EdgeRequest {
  /** @property {string} method - HTTP method */
  method: string;
  /** @property {string} url - Full request URL */
  url: string;
  /** @property {Record<string, string>} headers - Request headers */
  headers: Record<string, string>;
  /** @property {Record<string, string>} params - Route parameters */
  params: Record<string, string>;
  /** @property {Record<string, string>} query - Query string parameters */
  query: Record<string, string>;
  /** @property {unknown} body - Parsed request body */
  body: unknown;
}

/** @typedef {Object} EdgeResponse - Lightweight edge response */
export interface EdgeResponse {
  /** @property {number} status - HTTP status code */
  status: number;
  /** @property {Record<string, string>} headers - Response headers */
  headers: Record<string, string>;
  /** @property {string | ArrayBuffer} body - Response body */
  body: string | ArrayBuffer;
}

/**
 * Edge middleware function.
 * @param {EdgeRequest} req - Incoming request
 * @param {Function} next - Next middleware in the chain
 * @returns {Promise<EdgeResponse>}
 */
export type EdgeMiddleware = (
  req: EdgeRequest,
  next: (req: EdgeRequest) => Promise<EdgeResponse>,
) => Promise<EdgeResponse>;
