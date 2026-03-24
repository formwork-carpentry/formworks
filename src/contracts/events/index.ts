/**
 * @module @carpentry/core/contracts/events
 * @description Event dispatcher contract - the event system interface.
 *
 * Implementations: EventDispatcher, EventFake (for testing)
 *
 * @example
 * ```ts
 * class UserRegistered {
 *   constructor(public readonly userId: number) {}
 * }
 *
 * const events = container.make<IEventDispatcher>('events');
 * events.on(UserRegistered, async (event) => {
 *   if (!event) return;
 *   await sendWelcomeEmail(event.userId);
 * });
 * await events.dispatch(UserRegistered, new UserRegistered(42));
 * ```
 */

/** @typedef {Function} EventListener - Callback invoked when an event fires */
export type EventListener<T = unknown> = (payload?: T) => void | Promise<void>;

/** Constructor signature for class-based events. */
export type EventConstructor<T = unknown> = abstract new (...args: never[]) => T;

/** Event key accepted by the dispatcher. */
export type EventKey<T = unknown> = string | EventConstructor<T>;

export interface IEventSubscriber {
  subscribe(dispatcher: IEventDispatcher): void;
}

/** @typedef {Object} IEventDispatcher - Event system contract */
export interface IEventDispatcher {
  /**
   * Register a listener for an event.
  * @param {EventKey<T>} event - Event key (event class preferred; string supports wildcards)
   * @param {EventListener} listener - Callback to invoke
   * @returns {void}
   */
  on<T = unknown>(event: EventKey<T>, listener: EventListener<T>): () => void;

  /**
   * Register a one-time listener (auto-removed after first invocation).
  * @param {EventKey<T>} event - Event key
   * @param {EventListener} listener - Callback to invoke once
   * @returns {void}
   */
  once<T = unknown>(event: EventKey<T>, listener: EventListener<T>): () => void;

  /**
   * Remove a listener. If no listener specified, removes all for that event.
  * @param {EventKey} event - Event key
   * @param {EventListener} [listener] - Specific listener to remove
   * @returns {void}
   */
  off(event: EventKey, listener?: EventListener): void;

  /**
  * Dispatch an event to all registered listeners.
  * @param {EventKey<T>} event - Event key
  * @param {T} [payload] - Data passed to listeners
   * @returns {Promise<void>}
   * @example
   * ```ts
  * class OrderPlaced {
  *   constructor(public readonly orderId: number, public readonly total: number) {}
  * }
  *
  * await events.dispatch(OrderPlaced, new OrderPlaced(123, 99.99));
   * ```
   */
  dispatch<T = unknown>(event: EventKey<T>, payload?: T): Promise<void>;

  /**
  * @deprecated Since 1.0.0, use dispatch() instead.
  */
  emit<T = unknown>(event: EventKey<T>, payload?: T): Promise<void>;

  listeners(event: EventKey): EventListener[];

  hasListeners(event: EventKey): boolean;

  subscribe(subscriber: IEventSubscriber): void;

  clear(): void;
}
