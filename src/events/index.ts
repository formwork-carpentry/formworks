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
 * class UserRegistered {
 *   constructor(public readonly id: number, public readonly email: string) {}
 * }
 *
 * const events = new EventDispatcher();
 * events.on(UserRegistered, async (event) => {
 *   console.log('Welcome user', event?.email);
 * });
 *
 * await events.dispatch(UserRegistered, new UserRegistered(1, 'a@b.com'));
 * ```
 *
 * @see EventDispatcher — Main typed event dispatcher
 * @see EventFake — Test double for controlled assertions
 */

export { EventDispatcher, EventFake } from "./dispatcher/EventDispatcher.js";
