/**
 * @module @carpentry/edge
 * @description Edge runtime abstraction — detect capabilities, adapt APIs for edge environments
 * @patterns Adapter (normalize edge APIs), Strategy (runtime-specific adapters)
 * @principles DIP — app code uses EdgeRuntime, never Cloudflare/Deno APIs directly
 *             OCP — new edge runtimes via registerRuntime
 *
 * Use this package to:
 * - Detect the current runtime (`detectRuntime()`)
 * - Apply feature gating with computed capabilities (`getCapabilities()`)
 * - Use a consistent KV interface (`IEdgeKVStore`) with in-memory fallback
 *
 * @example
 * ```ts
 * import { detectRuntime, getCapabilities, InMemoryEdgeKV } from '@carpentry/edge';
 *
 * const runtime = detectRuntime();
 * const caps = getCapabilities(runtime);
 *
 * if (caps.hasKV) {
 *   const kv: InMemoryEdgeKV = new InMemoryEdgeKV();
 *   await kv.put('greeting', 'hello', 60);
 *   const v = await kv.get('greeting');
 *   // v === 'hello'
 * }
 * ```
 */

// ── Edge Runtime Detection ────────────────────────────────

export type EdgeRuntimeName =
  | "cloudflare-workers"
  | "deno-deploy"
  | "vercel-edge"
  | "bun"
  | "node"
  | "unknown";

export interface EdgeCapabilities {
  hasKV: boolean;
  hasDurableObjects: boolean;
  hasWebSocket: boolean;
  hasStreaming: boolean;
  hasCrypto: boolean;
  hasWasm: boolean;
  maxExecutionMs: number;
  maxMemoryMb: number;
}

export function detectRuntime(): EdgeRuntimeName {
  /**
   * @param {unknown} [typeof globalThis !== 'undefined']
   */
  if (typeof globalThis !== "undefined") {
    if ("Deno" in globalThis) return "deno-deploy";
    if ("Bun" in globalThis) return "bun";
    // @ts-expect-error — CF Workers global
    if (typeof caches !== "undefined" && typeof HTMLRewriter !== "undefined")
      return "cloudflare-workers";
  }
  /**
   * @param {unknown} [typeof process !== 'undefined' && process.versions?.node]
   */
  if (typeof process !== "undefined" && process.versions?.node) return "node";
  return "unknown";
}

/**
 * @param {EdgeRuntimeName} [runtime]
 * @returns {EdgeCapabilities}
 */
export function getCapabilities(runtime?: EdgeRuntimeName): EdgeCapabilities {
  const rt = runtime ?? detectRuntime();
  /**
   * @param {unknown} rt
   */
  switch (rt) {
    case "cloudflare-workers":
      return {
        hasKV: true,
        hasDurableObjects: true,
        hasWebSocket: true,
        hasStreaming: true,
        hasCrypto: true,
        hasWasm: true,
        maxExecutionMs: 30000,
        maxMemoryMb: 128,
      };
    case "deno-deploy":
      return {
        hasKV: true,
        hasDurableObjects: false,
        hasWebSocket: true,
        hasStreaming: true,
        hasCrypto: true,
        hasWasm: true,
        maxExecutionMs: 50000,
        maxMemoryMb: 512,
      };
    case "vercel-edge":
      return {
        hasKV: false,
        hasDurableObjects: false,
        hasWebSocket: false,
        hasStreaming: true,
        hasCrypto: true,
        hasWasm: true,
        maxExecutionMs: 25000,
        maxMemoryMb: 128,
      };
    case "bun":
      return {
        hasKV: false,
        hasDurableObjects: false,
        hasWebSocket: true,
        hasStreaming: true,
        hasCrypto: true,
        hasWasm: true,
        maxExecutionMs: Number.POSITIVE_INFINITY,
        maxMemoryMb: Number.POSITIVE_INFINITY,
      };
    case "node":
      return {
        hasKV: false,
        hasDurableObjects: false,
        hasWebSocket: false,
        hasStreaming: true,
        hasCrypto: true,
        hasWasm: true,
        maxExecutionMs: Number.POSITIVE_INFINITY,
        maxMemoryMb: Number.POSITIVE_INFINITY,
      };
    default:
      return {
        hasKV: false,
        hasDurableObjects: false,
        hasWebSocket: false,
        hasStreaming: false,
        hasCrypto: false,
        hasWasm: false,
        maxExecutionMs: 0,
        maxMemoryMb: 0,
      };
  }
}

// ── Edge KV Store Abstraction ─────────────────────────────

export interface IEdgeKVStore {
  /**
   * @param {string} key
   * @returns {Promise<string | null>}
   */
  get(key: string): Promise<string | null>;
  /**
   * @param {string} key
   * @param {string} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  put(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  delete(key: string): Promise<void>;
  /**
   * @param {string} [prefix]
   * @returns {Promise<string[]>}
   */
  list(prefix?: string): Promise<string[]>;
}

/**
 * InMemoryEdgeKV — in-memory key/value store for edge runtimes.
 *
 * Designed for:
 * - tests
 * - local development when you don't have the real edge KV available
 *
 * @example
 * ```ts
 * const kv = new InMemoryEdgeKV();
 * await kv.put('greeting', 'hello', 60);
 * const v = await kv.get('greeting');
 * // v === 'hello'
 * ```
 */
export class InMemoryEdgeKV implements IEdgeKVStore {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  /**
   * @param {string} key
   * @returns {Promise<string | null>}
   */
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {string} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  async put(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }

  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * @param {string} [prefix]
   * @returns {Promise<string[]>}
   */
  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    for (const key of this.store.keys()) {
      if (!prefix || key.startsWith(prefix)) keys.push(key);
    }
    return keys;
  }

  size(): number {
    return this.store.size;
  }
  reset(): void {
    this.store.clear();
  }
}

// ── Edge Handler Adapter ──────────────────────────────────

export type EdgeHandler = (request: Request) => Response | Promise<Response>;

/**
 * EdgeAdapter normalizes request/response handling across edge runtimes.
 * Wraps a Carpenter HttpKernel handler into the format each edge runtime expects.
 *
 * @example
 * ```ts
 * const adapter = new EdgeAdapter('node');
 * const handler = adapter.adapt(async (req) => edgeJson({ ok: true }));
 * const res = await handler(new Request('https://example.com/health'));
 * ```
 */
export class EdgeAdapter {
  private runtime: EdgeRuntimeName;
  private capabilities: EdgeCapabilities;

  constructor(runtime?: EdgeRuntimeName) {
    this.runtime = runtime ?? detectRuntime();
    this.capabilities = getCapabilities(this.runtime);
  }

  getRuntime(): EdgeRuntimeName {
    return this.runtime;
  }
  getCapabilities(): EdgeCapabilities {
    return this.capabilities;
  }

  /** Check if a feature is available */
  /**
   * @param {keyof EdgeCapabilities} feature
   * @returns {boolean}
   */
  supports(feature: keyof EdgeCapabilities): boolean {
    return Boolean(this.capabilities[feature]);
  }

  /** Wrap a Carpenter handler for the edge runtime */
  /**
   * @param {EdgeHandler} handler
   * @returns {EdgeHandler}
   */
  adapt(handler: EdgeHandler): EdgeHandler {
    return async (request: Request): Promise<Response> => {
      try {
        return await handler(request);
      } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    };
  }

  /** Check if running in a constrained edge environment */
  isEdge(): boolean {
    return this.runtime !== "node" && this.runtime !== "unknown";
  }

  /** Check if a module is safe to use in the current runtime */
  /**
   * @param {Partial<EdgeCapabilities>} requirements
   */
  assertCompatible(requirements: Partial<EdgeCapabilities>): void {
    for (const [key, required] of Object.entries(requirements)) {
      const k = key as keyof EdgeCapabilities;
      if (required && !this.capabilities[k]) {
        throw new Error(`Feature "${k}" required but not available in ${this.runtime}.`);
      }
    }
  }
}

export { EdgeKernel, edgeJson, edgeText, edgeRedirect, edgeCors } from "./EdgeKernel.js";
export type { EdgeRequest, EdgeResponse, EdgeMiddleware, EdgeRoute } from "./EdgeKernel.js";
export { IsrManager } from "./IsrManager.js";
export type { IsrConfig, IsrPage } from "./IsrManager.js";
export { edgeGeo, edgeABTest, edgeBotGuard, resolveABVariant } from "./EdgeMiddleware.js";
export type {
  GeoRouteConfig,
  ABTestConfig,
  ABTestResult,
  BotGuardConfig,
} from "./EdgeMiddleware.js";

export { IsrCache } from "./isr.js";
export type { IsrEntry, IsrResult } from "./isr.js";
