/**
 * @module @formwork/core/contracts/auth
 * @description Authentication contracts - guard and user provider interfaces.
 *
 * Implementations: JwtGuard, MemoryGuard, InMemoryUserProvider
 *
 * @example
 * ```ts
 * const guard = container.make<IAuthGuard>('auth');
 * const ok = await guard.attempt({ email: 'user@test.com', password: 'secret' });
 * if (ok) console.log('User ID:', await guard.id());
 * ```
 */
export {};
//# sourceMappingURL=index.js.map