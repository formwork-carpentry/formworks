/**
 * @module @carpentry/auth
 * @description Authentication guards, authorization {@link Gate}, and password hashing {@link HashManager}.
 *
 * Use this package to:
 * - Hash and verify secrets with {@link HashManager} (swap hashing drivers)
 * - Authorize actions with {@link Gate} (abilities + policies + `before()` hooks)
 * - Authenticate requests using {@link JwtGuard} (stateless token auth) or session-aware guards
 *
 * @example
 * ```ts
 * import { HashManager, Sha256HashDriver, Gate } from '@carpentry/auth';
 *
 * const hashes = new HashManager();
 * hashes.registerDriver('sha256', new Sha256HashDriver());
 *
 * const gate = new Gate();
 * gate.define('post.edit', async (user, post) => user.id === post.authorId);
 *
 * const canEdit = await gate.allows(user, 'post.edit', post);
 * ```
 *
 * @see HashManager — Password hashing API
 * @see Gate — Authorization abilities/policies
 * @see JwtGuard — JWT authentication guard
 */

export { HashManager, Sha256HashDriver } from "./hash/HashManager.js";
export { Gate } from "./gate/Gate.js";
export { MemoryGuard, InMemoryUserProvider, SimpleUser } from "./guards/Guards.js";
export { JwtGuard, createToken, verifyToken } from "./guards/JwtGuard.js";
export type { JwtConfig, JwtPayload, JwtVerifyResult } from "./guards/JwtGuard.js";
