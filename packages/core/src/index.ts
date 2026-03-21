/**
 * @module @formwork/core
 * @deprecated Use granular entry points instead (see note below).
 * @description Framework core — use granular imports for better tree-shaking and explicitness.
 *
 * **Migration Guide:**
 * - `import { Container } from '@formwork/core'` → `import { Container } from '@formwork/core/container'`
 * - `import { Config, env } from '@formwork/core'` → `import { Config, env } from '@formwork/core/config'`
 * - `import type { IRequest } from '@formwork/core'` → `import type { IRequest } from '@formwork/core/contracts'`
 * - `import { Application } from '@formwork/core'` → `import { Application } from '@formwork/core/application'`
 * - `import { CarpenterError } from '@formwork/core'` → `import { CarpenterError } from '@formwork/core/exceptions'`
 *
 * **Available entry points:**
 * - `@formwork/core/types` — Foundation types (Token, Constructor, Result)
 * - `@formwork/core/container` — IoC Container + decorators
 * - `@formwork/core/config` — Configuration management
 * - `@formwork/core/application` — Application lifecycle
 * - `@formwork/core/exceptions` — Error hierarchy
 * - `@formwork/core/plugin` — TypeScript plugin system
 * - `@formwork/core/decorator` — Decorators (@Injectable, @Inject, etc.)
 * - `@formwork/core/contracts` — All framework contracts (IRequest, IResponse, IDatabaseAdapter, ICacheStore, IQueueAdapter, IMailManager, IStorageManager, IEventDispatcher, IValidator, IAuthGuard, ISession, etc.)
 *
 * This main entry point is **empty** to force explicit, granular imports.
 * Granular imports enable better tree-shaking and clarify which dependencies you're using.
 */

// Empty intentionally — use granular entry points above
export {};
