/**
 * @module @formwork/core/contracts/queue
 * @description Queue adapter contract - all queue drivers implement this interface.
 *
 * Implementations: SyncQueue, MemoryQueue, DatabaseQueueAdapter, BullMqAdapter
 *
 * @example
 * ```ts
 * const queue = container.make<IQueueAdapter>('queue');
 * await queue.push({ name: 'SendEmail', payload: { to: 'user@test.com' } });
 * await queue.later(60, { name: 'SendReminder', payload: { userId: 42 } });
 * ```
 */
export {};
//# sourceMappingURL=index.js.map