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
 * - `@carpentry/formworks/core/types` — Foundation types (Token, Constructor, Result)
 * - `@carpentry/formworks/core/container` — IoC Container + decorators
 * - `@carpentry/formworks/core/config` — Configuration management
 * - `@carpentry/formworks/core/application` — Application lifecycle
 * - `@carpentry/formworks/core/exceptions` — Error hierarchy
 * - `@carpentry/formworks/tooling` — TypeScript plugin and IDE tooling
 * - `@carpentry/formworks/core/decorator` — Decorators (@Injectable, @Inject, etc.)
 * - `@carpentry/formworks/contracts` — First-class framework contracts
 *
 * This main entry point is **empty** to force explicit, granular imports.
 * Granular imports enable better tree-shaking and clarify which dependencies you're using.
 */

// Empty intentionally — use granular entry points above
export {};
