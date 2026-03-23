/**
 * @module @carpentry/events
 * @description Event dispatcher, listeners, subscribers, and {@link EventFake} for testing.
 *
 * Use this package to:
 * - Decouple components by dispatching events instead of calling directly
 * - Register listeners with `on()` / `once()` and remove them with `off()` or unsubscribe
 * - Support wildcard listeners like `user.*`
 *
 * @example
 * ```ts
 * import { EventDispatcher } from './';
 *
 * const events = new EventDispatcher();
 * events.on('user.registered', async (payload) => {
 *   console.log('Welcome user', payload);
 * });
 *
 * await events.dispatch('user.registered', { id: 1, email: 'a@b.com' });
 * ```
 *
 * @see EventDispatcher — Main typed event dispatcher
 * @see EventFake — Test double for controlled assertions
 */

export { EventDispatcher, EventFake } from "./dispatcher/EventDispatcher.js";
