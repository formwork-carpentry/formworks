/**
 * @module @formwork/core/types
 * @description Foundation types — Token, Constructor, Result, and other fundamental type utilities.
 *
 * @example
 * ```ts
 * import type { Token, Constructor, Result } from '@formwork/core/types';
 *
 * const MyToken = new Token<MyService>('my-service');
 * type Resolved = Constructor<MyService>;
 * type Outcome = Result<Data, Error>;
 * ```
 */

export * from "./types/index.js";
