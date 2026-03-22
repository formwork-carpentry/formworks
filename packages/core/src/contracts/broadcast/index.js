/**
 * @module @formwork/core/contracts/broadcast
 * @description Broadcasting contract - real-time event delivery to channels.
 *
 * Implementations: InMemoryBroadcaster, LogBroadcaster
 *
 * @example
 * ```ts
 * const broadcaster = container.make<IBroadcaster>('broadcast');
 * broadcaster.broadcast('post.42', 'NewComment', { body: 'Great post!' });
 * ```
 */
export {};
//# sourceMappingURL=index.js.map