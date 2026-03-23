/**
 * @module @carpentry/core
 * @deprecated Use granular entry points instead (see note below).
 * @description Framework core — use granular imports for better tree-shaking and explicitness.
 *
 * **Migration Guide:**
 * - `import { Container } from '@carpentry/core'` → `import { Container } from '@carpentry/core/container'`
 * - `import { Config, env } from '@carpentry/core'` → `import { Config, env } from '@carpentry/core/config'`
 * - `import type { IRequest } from '@carpentry/core'` → `import type { IRequest } from '@carpentry/core/contracts'`
 * - `import { Application } from '@carpentry/core'` → `import { Application } from '@carpentry/core/application'`
 * - `import { CarpenterError } from '@carpentry/core'` → `import { CarpenterError } from '@carpentry/core/exceptions'`
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
