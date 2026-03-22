/**
 * @module @formwork/core/contracts/events
 * @description Event dispatcher contract - the event system interface.
 *
 * Implementations: EventDispatcher, EventFake (for testing)
 *
 * @example
 * ```ts
 * const events = container.make<IEventDispatcher>('events');
 * events.on('user.registered', async (data) => { sendWelcomeEmail(data); });
 * await events.dispatch('user.registered', { userId: 42 });
 * ```
 */
export {};
//# sourceMappingURL=index.js.map