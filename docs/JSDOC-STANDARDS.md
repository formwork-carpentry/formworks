# Carpenter JSDoc / TSDoc Standards

Developer experience is a top priority. All public APIs must have clear, helpful documentation that makes the framework easy to master.

## Principles

1. **Every public export is documented** — classes, interfaces, functions, methods.
2. **Examples over prose** — `@example` blocks show real, copy-pasteable usage.
3. **Param and return types** — `@param` and `@returns` for all parameters and return values.
4. **Cross-references** — `@see` and `{@link}` to related APIs.
5. **Edge cases** — `@throws` when errors are thrown; `@remarks` for gotchas.

## Unified Vocabulary (Required)

Use consistent language across code, docs, tests, and examples:

- **in-memory**: canonical term for runtime-only data stores and adapters.
  - Use `in-memory`, not `memory` or `inmemory` in prose/comments.
  - Driver identifiers can remain implementation-specific (for example, `memory`) when required by config APIs.
- **test double**: umbrella term for testing stand-ins.
  - **fake**: working in-memory implementation used in tests/dev.
  - **stub**: placeholder that returns fixed values or throws predictable errors.
  - **mock**: interaction-verification double used to assert calls.
- Prefer describing behavior first, then implementation label.
  - Good: "in-memory test double (fake adapter)"
  - Avoid: "array adapter" without context

## Unified Code And Comment Style

- Keep module header blocks in the same order: brief description, `Demonstrates` bullets, then imports.
- Prefer concise comments only where intent is not obvious.
- Keep one style for response adaptation helpers in HTTP examples (single local helper near router setup).
- Use consistent sentence casing and punctuation in comments and TSDoc.
- Avoid redundant comments that just restate types.

## Required Tags

| Tag | When to use |
|-----|-------------|
| `@description` | Brief one-line summary (or first paragraph). |
| `@param name - description` | For every parameter. |
| `@returns` | For non-void return values. |
| `@throws` | When the function throws (with condition). |
| `@example` | At least one usage example per public API. |
| `@see` | Related APIs, guides, or modules. |

## Optional Tags

| Tag | When to use |
|-----|-------------|
| `@remarks` | Edge cases, gotchas, performance notes. |
| `@deprecated` | For deprecated APIs (with migration path). |
| `@since` | Version when introduced (if tracked). |

## Module-Level Documentation

```ts
/**
 * @module @formwork/package-name
 * @description One-line summary of what this package does.
 *
 * Use this package to:
 * - First use case
 * - Second use case
 *
 * @example
 * ```ts
 * import { Foo } from '@formwork/package-name';
 * const foo = new Foo();
 * foo.doSomething();
 * ```
 */
```

## Class Documentation

```ts
/**
 * Brief description of the class and its purpose.
 *
 * @example
 * ```ts
 * const instance = new MyClass(options);
 * await instance.run();
 * ```
 *
 * @see {@link RelatedClass}
 */
export class MyClass {
  /**
   * What this method does.
   *
   * @param id - Unique identifier.
   * @param options - Optional configuration.
   * @returns The result.
   * @throws {NotFoundError} When id is not found.
   *
   * @example
   * ```ts
   * const result = await instance.fetch('abc', { cache: true });
   * ```
   */
  async fetch(id: string, options?: FetchOptions): Promise<Result> { ... }
}
```

## Interface / Type Documentation

```ts
/**
 * Represents a user with auth metadata.
 *
 * @example
 * ```ts
 * const user: User = { id: '1', email: 'a@b.com', roles: ['admin'] };
 * ```
 */
export interface User {
  /** Unique identifier. */
  id: string;
  /** Email address. */
  email: string;
  /** Assigned roles. */
  roles: string[];
}
```

## Function Documentation

```ts
/**
 * Formats bytes as human-readable size (e.g. "1.5 MB").
 *
 * @param bytes - Size in bytes.
 * @returns Formatted string.
 *
 * @example
 * ```ts
 * formatFileSize(1536000);  // '1.5 MB'
 * formatFileSize(0);       // '0 B'
 * ```
 */
export function formatFileSize(bytes: number): string { ... }
```

## Example Quality

- **Runnable** — Examples should work when copy-pasted (with minimal imports).
- **Realistic** — Use realistic values, not foo/bar.
- **Focused** — One concept per example.
- **Complete** — Include necessary imports and setup.

## Anti-Patterns

- ❌ Vague descriptions: "Does stuff"
- ❌ Missing examples for public APIs
- ❌ JSDoc that only repeats the type signature
- ❌ Broken or outdated examples

## Packages with Full JSDoc (Reference)

These packages follow the standard and serve as examples:

- **@formwork/media** — Gold standard (types, collection, pipeline, docgen, mime, adapters)
- **@formwork/foundation** — bootstrap, BootstrapOptions
- **@formwork/events** — EventDispatcher, on, once, emit
- **@formwork/cache** — CacheManager, store, registerDriver
- **@formwork/core** — Module header
- **@formwork/http** — Module header, CarpenterResponse.json
- **@formwork/auth** — Module header
- **@formwork/i18n** — Module header
- **@formwork/helpers** — Module header
- **@formwork/resilience** — Module header
- **@formwork/http-client** — Module header

Additional packages (orm, storage, session, validation) were updated via parallel task.
