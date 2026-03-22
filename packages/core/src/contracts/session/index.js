/**
 * @module @formwork/core/contracts/session
 * @description Session store contract - all session drivers implement this interface.
 *
 * Implementations: MemorySessionStore, FileSessionStore
 *
 * @example
 * ```ts
 * const store = container.make<ISessionStore>('session.store');
 * const data = await store.read('session-id-abc');
 * await store.write('session-id-abc', { user: { id: 1 } });
 * ```
 */
export {};
//# sourceMappingURL=index.js.map