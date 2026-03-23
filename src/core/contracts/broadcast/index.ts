/**
 * @module @carpentry/core/contracts/broadcast
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

/** @typedef {Object} IBroadcaster - Broadcasting contract */
export interface IBroadcaster {
  /**
   * Broadcast an event to a channel.
   * @param {string} channel - Channel name (e.g., 'post.42', 'chat.room-1')
   * @param {string} event - Event name (e.g., 'NewComment', 'MessageSent')
   * @param {unknown} data - Event payload
   * @returns {void}
   */
  broadcast(channel: string, event: string, data: unknown): void;
}
