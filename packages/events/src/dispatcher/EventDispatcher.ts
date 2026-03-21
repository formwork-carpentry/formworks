/**
 * @module @formwork/events
 * @description EventDispatcher — typed event dispatch with wildcards, once, and testable EventFake
 * @patterns Mediator (dispatcher), Observer (listeners)
 * @principles SRP — event routing only; OCP — new events/listeners without modifying dispatcher
 */

import type { EventListener, IEventDispatcher, IEventSubscriber } from "@formwork/core/contracts";
import type { Unsubscribe } from "@formwork/core/types";

/**
 * EventDispatcher — typed event dispatcher with wildcard listeners and "once" handlers.
 *
 * It supports:
 * - Exact listeners via `on()` / `once()`
 * - Wildcard listeners like `user.*` (matches `user.registered`, `user.deleted`, etc.)
 * - Unsubscribe via the `Unsubscribe` function returned by `on()` / `once()`
 *
 * @example
 * ```ts
 * const events = new EventDispatcher();
 *
 * const unsubscribe = events.on('user.registered', async (payload) => {
 *   console.log('Welcome user', payload);
 * });
 *
 * await events.dispatch('user.registered', { id: 1, email: 'a@b.com' });
 * unsubscribe(); // stop listening
 * ```
 */
export class EventDispatcher implements IEventDispatcher {
  private listenerMap = new Map<string, Array<{ handler: EventListener; once: boolean }>>();

  /**
   * @param {string | Function} event
   * @param {EventListener<T>} listener
   * @returns {Unsubscribe}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  on<T = unknown>(event: string | Function, listener: EventListener<T>): Unsubscribe {
    const key = this.eventKey(event);
    if (!this.listenerMap.has(key)) {
      this.listenerMap.set(key, []);
    }
    const entry = { handler: listener as EventListener, once: false };
    this.listenerMap.get(key)?.push(entry);

    return () => {
      const arr = this.listenerMap.get(key);
      if (arr) {
        const idx = arr.indexOf(entry);
        if (idx !== -1) arr.splice(idx, 1);
      }
    };
  }

  /**
   * @param {string | Function} event
   * @param {EventListener<T>} listener
   * @returns {Unsubscribe}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  once<T = unknown>(event: string | Function, listener: EventListener<T>): Unsubscribe {
    const key = this.eventKey(event);
    if (!this.listenerMap.has(key)) {
      this.listenerMap.set(key, []);
    }
    const entry = { handler: listener as EventListener, once: true };
    this.listenerMap.get(key)?.push(entry);

    return () => {
      const arr = this.listenerMap.get(key);
      if (arr) {
        const idx = arr.indexOf(entry);
        if (idx !== -1) arr.splice(idx, 1);
      }
    };
  }

  /**
   * @param {string | Function} event
   * @param {T} [payload]
   * @returns {Promise<void>}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  async emit<T = unknown>(event: string | Function, payload?: T): Promise<void> {
    const key = this.eventKey(event);

    // Exact match listeners
    await this.invokeListeners(key, payload);

    // Wildcard listeners: 'user.*' matches 'user.registered', 'user.deleted'
    for (const [pattern, entries] of this.listenerMap) {
      if (pattern.endsWith(".*") && entries.length > 0) {
        const prefix = pattern.slice(0, -2);
        if (key.startsWith(`${prefix}.`) || key === prefix) {
          await this.invokeEntries(pattern, entries, payload);
        }
      }
    }
  }

  /** Alias for emit() — Laravel-style dispatch(event, payload) */
  /**
   * @param {string | Function} event
   * @param {T} [payload]
   * @returns {Promise<void>}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  async dispatch<T = unknown>(event: string | Function, payload?: T): Promise<void> {
    return this.emit(event, payload);
  }

  /**
   * @param {string | Function} event
   * @param {EventListener} [listener]
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  off(event: string | Function, listener?: EventListener): void {
    const key = this.eventKey(event);
    if (!listener) {
      this.listenerMap.delete(key);
      return;
    }
    const arr = this.listenerMap.get(key);
    if (arr) {
      const idx = arr.findIndex((e) => e.handler === listener);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }

  /**
   * @param {string | Function} event
   * @returns {EventListener[]}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  listeners(event: string | Function): EventListener[] {
    const key = this.eventKey(event);
    return (this.listenerMap.get(key) ?? []).map((e) => e.handler);
  }

  /**
   * @param {string | Function} event
   * @returns {boolean}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  hasListeners(event: string | Function): boolean {
    const key = this.eventKey(event);
    const arr = this.listenerMap.get(key);
    return arr !== undefined && arr.length > 0;
  }

  /** Register an EventSubscriber (registers multiple events at once) */
  /**
   * @param {IEventSubscriber} subscriber
   */
  subscribe(subscriber: IEventSubscriber): void {
    subscriber.subscribe(this);
  }

  /** Clear all listeners */
  clear(): void {
    this.listenerMap.clear();
  }

  // ── Internal ────────────────────────────────────────────

  private async invokeListeners(key: string, payload: unknown): Promise<void> {
    const entries = this.listenerMap.get(key);
    if (!entries) return;
    await this.invokeEntries(key, entries, payload);
  }

  private async invokeEntries(
    _key: string,
    entries: Array<{ handler: EventListener; once: boolean }>,
    payload: unknown,
  ): Promise<void> {
    const toRemove: number[] = [];
    for (let i = 0; i < entries.length; i++) {
      await entries[i].handler(payload);
      if (entries[i].once) toRemove.push(i);
    }
    // Remove once-listeners in reverse to preserve indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      entries.splice(toRemove[i], 1);
    }
  }

  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  private eventKey(event: string | Function): string {
    return typeof event === "function" ? event.name : event;
  }
}

// ── EventFake (for testing) ───────────────────────────────

/**
 * EventFake — replaces the real dispatcher during tests.
 * Records all emitted events for assertions instead of dispatching.
 *
 * @example
 * ```typescript
 * const fake = EventFake.create();
 * // ... run code that emits events ...
 * fake.assertDispatched('UserRegistered');
 * fake.assertNotDispatched('UserDeleted');
 * fake.assertDispatchedTimes('OrderPlaced', 3);
 * ```
 */
export class EventFake implements IEventDispatcher {
  private dispatched: Array<{ event: string; payload: unknown }> = [];
  private realDispatcher: EventDispatcher;

  constructor() {
    this.realDispatcher = new EventDispatcher();
  }

  static create(): EventFake {
    return new EventFake();
  }

  // Listeners still register (so subscriber.subscribe works)
  /**
   * @param {string | Function} event
   * @param {EventListener<T>} listener
   * @returns {Unsubscribe}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  on<T = unknown>(event: string | Function, listener: EventListener<T>): Unsubscribe {
    return this.realDispatcher.on(event, listener);
  }

  /**
   * @param {string | Function} event
   * @param {EventListener<T>} listener
   * @returns {Unsubscribe}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  once<T = unknown>(event: string | Function, listener: EventListener<T>): Unsubscribe {
    return this.realDispatcher.once(event, listener);
  }

  // Emit records the event but does NOT call listeners
  /**
   * @param {string | Function} event
   * @param {T} [payload]
   * @returns {Promise<void>}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  async emit<T = unknown>(event: string | Function, payload?: T): Promise<void> {
    const key = typeof event === "function" ? event.name : event;
    this.dispatched.push({ event: key, payload });
  }

  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  async dispatch<T = unknown>(event: string | Function, payload?: T): Promise<void> {
    await this.emit(event, payload);
  }

  /**
   * @param {string | Function} event
   * @param {EventListener} [listener]
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  off(event: string | Function, listener?: EventListener): void {
    this.realDispatcher.off(event, listener);
  }

  /**
   * @param {string | Function} event
   * @returns {EventListener[]}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  listeners(event: string | Function): EventListener[] {
    return this.realDispatcher.listeners(event);
  }

  /**
   * @param {string | Function} event
   * @returns {boolean}
   */
  // biome-ignore lint/complexity/noBannedTypes: event can be class reference or string name per IEventDispatcher contract
  hasListeners(event: string | Function): boolean {
    return this.realDispatcher.hasListeners(event);
  }

  subscribe(subscriber: IEventSubscriber): void {
    subscriber.subscribe(this.realDispatcher);
  }

  clear(): void {
    this.dispatched = [];
    this.realDispatcher.clear();
  }

  // ── Assertions ──────────────────────────────────────────

  /**
   * @param {string} event
   * @param {(payload: unknown} [predicate]
   */
  assertDispatched(event: string, predicate?: (payload: unknown) => boolean): void {
    const found = this.dispatched.filter((d) => d.event === event);
    if (found.length === 0) {
      throw new Error(`Expected event "${event}" to be dispatched, but it was not.`);
    }
    if (predicate) {
      const match = found.some((d) => predicate(d.payload));
      if (!match) {
        throw new Error(`Event "${event}" was dispatched, but no payload matched the predicate.`);
      }
    }
  }

  /**
   * @param {string} event
   */
  assertNotDispatched(event: string): void {
    const found = this.dispatched.filter((d) => d.event === event);
    if (found.length > 0) {
      throw new Error(
        `Expected event "${event}" NOT to be dispatched, but it was dispatched ${found.length} time(s).`,
      );
    }
  }

  /**
   * @param {string} event
   * @param {number} times
   */
  assertDispatchedTimes(event: string, times: number): void {
    const found = this.dispatched.filter((d) => d.event === event);
    if (found.length !== times) {
      throw new Error(
        `Expected event "${event}" to be dispatched ${times} time(s), but was dispatched ${found.length} time(s).`,
      );
    }
  }

  assertNothingDispatched(): void {
    if (this.dispatched.length > 0) {
      const names = [...new Set(this.dispatched.map((d) => d.event))].join(", ");
      throw new Error(`Expected no events dispatched, but found: ${names}`);
    }
  }

  /** Get all dispatched events (for custom assertions) */
  getDispatched(): Array<{ event: string; payload: unknown }> {
    return [...this.dispatched];
  }

  /** Reset recorded events */
  reset(): void {
    this.dispatched = [];
  }
}
