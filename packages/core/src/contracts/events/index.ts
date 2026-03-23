/**
 * @module @carpentry/core/contracts/events
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

/** @typedef {Function} EventListener - Callback invoked when an event fires */
export type EventListener<T = unknown> = (payload?: T) => void | Promise<void>;

export interface IEventSubscriber {
  subscribe(dispatcher: IEventDispatcher): void;
}

/** @typedef {Object} IEventDispatcher - Event system contract */
export interface IEventDispatcher {
  /**
   * Register a listener for an event.
   * @param {string | Function} event - Event name (supports wildcards: 'user.*')
   * @param {EventListener} listener - Callback to invoke
   * @returns {void}
   */
  // biome-ignore lint/complexity/noBannedTypes: Function type for event class references per contract
  on<T = unknown>(event: string | Function, listener: EventListener<T>): () => void;

  /**
   * Register a one-time listener (auto-removed after first invocation).
   * @param {string | Function} event - Event name
   * @param {EventListener} listener - Callback to invoke once
   * @returns {void}
   */
  // biome-ignore lint/complexity/noBannedTypes: Function type for event class references per contract
  once<T = unknown>(event: string | Function, listener: EventListener<T>): () => void;

  /**
   * Remove a listener. If no listener specified, removes all for that event.
   * @param {string | Function} event - Event name
   * @param {EventListener} [listener] - Specific listener to remove
   * @returns {void}
   */
  // biome-ignore lint/complexity/noBannedTypes: Function type for event class references per contract
  off(event: string | Function, listener?: EventListener): void;

  /**
   * Dispatch an event to all registered listeners.
   * @param {string | Function} event - Event name
   * @param {T} [payload] - Data passed to listeners
   * @returns {Promise<void>}
   * @example
   * ```ts
   * await events.dispatch('order.placed', { orderId: 123, total: 99.99 });
   * ```
   */
  // biome-ignore lint/complexity/noBannedTypes: Function type for event class references per contract
  emit<T = unknown>(event: string | Function, payload?: T): Promise<void>;

  // biome-ignore lint/complexity/noBannedTypes: Function type for event class references per contract
  dispatch<T = unknown>(event: string | Function, payload?: T): Promise<void>;

  // biome-ignore lint/complexity/noBannedTypes: Function type for event class references per contract
  listeners(event: string | Function): EventListener[];

  // biome-ignore lint/complexity/noBannedTypes: Function type for event class references per contract
  hasListeners(event: string | Function): boolean;

  subscribe(subscriber: IEventSubscriber): void;

  clear(): void;
}
