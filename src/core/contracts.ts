/**
 * @module @carpentry/core/contracts
 * @description Framework contracts — all 31 framework interfaces in one entry point.
 *
 * For granular imports by concern, use individual entry points:
 * - @carpentry/core/contracts/http
 * - @carpentry/core/contracts/orm
 * - @carpentry/core/contracts/cache
 * - etc.
 *
 * @example
 * ```ts
 * // Option 1: Everything via contracts
 * import type {
 *   IRequest,
 *   IDatabaseAdapter,
 *   ICacheStore,
 *   IQueueAdapter,
 * } from './contracts';
 *
 * // Option 2: Granular (recommended for tree-shaking)
 * import type { IRequest } from './contracts/http';
 * import type { IDatabaseAdapter } from './contracts/orm';
 * ```
 */

export * from "./contracts/http/index.js";
export * from "./contracts/orm/index.js";
export * from "./contracts/cache/index.js";
export * from "./contracts/queue/index.js";
export * from "./contracts/mail/index.js";
export * from "./contracts/storage/index.js";
export * from "./contracts/auth/index.js";
export * from "./contracts/events/index.js";
export * from "./contracts/validation/index.js";
export * from "./contracts/session/index.js";
export * from "./contracts/broadcast/index.js";
export * from "./contracts/bridge/index.js";
export * from "./contracts/edge/index.js";
export * from "./contracts/ai/index.js";
export * from "./contracts/graphql/index.js";
export * from "./contracts/otel/index.js";
export * from "./contracts/tenancy/index.js";
export * from "./contracts/flags/index.js";
export * from "./contracts/wasm/index.js";
export * from "./contracts/i18n/index.js";
export * from "./contracts/container/index.js";
export * from "./contracts/search/index.js";
export * from "./contracts/health/index.js";
export * from "./contracts/audit/index.js";
export * from "./contracts/webhook/index.js";
export * from "./contracts/encrypt/index.js";
export * from "./contracts/pipeline/index.js";
export * from "./contracts/analytics/index.js";
export * from "./contracts/geo/index.js";
export * from "./contracts/pdf/index.js";
export * from "./contracts/excel/index.js";
