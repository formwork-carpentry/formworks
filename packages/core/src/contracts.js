/**
 * @module @formwork/core/contracts
 * @description Framework contracts — all 21 framework interfaces in one entry point.
 *
 * For granular imports by concern, use individual entry points:
 * - @formwork/core/contracts/http
 * - @formwork/core/contracts/orm
 * - @formwork/core/contracts/cache
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
 * } from '@formwork/core/contracts';
 *
 * // Option 2: Granular (recommended for tree-shaking)
 * import type { IRequest } from '@formwork/core/contracts/http';
 * import type { IDatabaseAdapter } from '@formwork/core/contracts/orm';
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
//# sourceMappingURL=contracts.js.map