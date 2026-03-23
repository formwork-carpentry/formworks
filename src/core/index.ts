/**
 * @module @carpentry/core
 * @deprecated Use granular entry points instead (see note below).
 * @description Framework core — use granular imports for better tree-shaking and explicitness.
 *
 * **Migration Guide:**
 * - `import { Container } from './'` → `import { Container } from './container'`
 * - `import { Config, env } from './'` → `import { Config, env } from './config'`
 * - `import type { IRequest } from './'` → `import type { IRequest } from './contracts'`
 * - `import { Application } from './'` → `import { Application } from './application'`
 * - `import { CarpenterError } from './'` → `import { CarpenterError } from './exceptions'`
 *
 * **Available entry points:**
 * - `@carpentry/core/types` — Foundation types (Token, Constructor, Result)
 * - `@carpentry/core/container` — IoC Container + decorators
 * - `@carpentry/core/config` — Configuration management
 * - `@carpentry/core/application` — Application lifecycle
 * - `@carpentry/core/exceptions` — Error hierarchy
 * - `@carpentry/core/plugin` — TypeScript plugin system
 * - `@carpentry/core/decorator` — Decorators (@Injectable, @Inject, etc.)
 * - `@carpentry/core/contracts` — All framework contracts (IRequest, IResponse, IDatabaseAdapter, ICacheStore, IQueueAdapter, IMailManager, IStorageManager, IEventDispatcher, IValidator, IAuthGuard, ISession, etc.)
 *
 * This main entry point is **empty** to force explicit, granular imports.
 * Granular imports enable better tree-shaking and clarify which dependencies you're using.
 */

// Empty intentionally — use granular entry points above
export {};
