/**
 * @module @carpentry/notifications
 * @description Built-in notification channel implementations
 * @patterns Strategy
 */

import type { INotificationChannel, DatabaseChannelMessage, Notifiable } from './types.js';

/**
 * LogChannel — stores notification deliveries in an in-memory log.
 *
 * Intended for debugging and local dev environments:
 * - inspect deliveries with `getLog()`
 * - clear state with `reset()`
 *
 * @example
 * ```ts
 * const manager = new NotificationManager().channel('log', new LogChannel());
 *
 * class User implements Notifiable {
 *   constructor(public email: string) {}
 *   routeNotificationFor(_channel: string) { return null; }
 * }
 *
 * class Ping extends BaseNotification<{ ok: true }> {
 *   via() { return ['log']; }
 * }
 *
 * await manager.send(new User('a@example.com'), new Ping({ ok: true }));
 * const entries = manager.getChannel<LogChannel>('log').getLog();
 * ```
 */
export class LogChannel implements INotificationChannel {
  readonly name = 'log';
  private log: Array<{ notifiable: Notifiable; message: unknown }> = [];

  /**
   * @param {Notifiable} notifiable
   * @param {unknown} message
   * @returns {Promise<void>}
   */
  async send(notifiable: Notifiable, message: unknown): Promise<void> {
    this.log.push({ notifiable, message });
  }

  getLog() { return [...this.log]; }
  reset() { this.log = []; }
}

/**
 * ArrayChannel — records notifications for assertions and inspection.
 *
 * Designed for tests:
 * - `assertSentTo()` checks delivery to a given notifiable
 * - `assertSentWithData()` lets you assert based on the delivered message/payload
 * - `assertCount()` and `assertNothingSent()` are convenience helpers
 *
 * @example
 * ```ts
 * const manager = new NotificationManager().channel('array', new ArrayChannel('array'));
 *
 * class User implements Notifiable {
 *   constructor(public id: string) {}
 *   routeNotificationFor(_channel: string) { return this.id; }
 * }
 *
 * class Welcome extends BaseNotification<{ name: string }> {
 *   via() { return ['array']; }
 * }
 *
 * const user = new User('u1');
 * await manager.send(user, new Welcome({ name: 'Alice' }));
 *
 * const channel = manager.getChannel<ArrayChannel>('array');
 * channel.assertSentTo(user);
 * channel.assertCount(1);
 * ```
 */
export class ArrayChannel implements INotificationChannel {
  readonly name: string;
  private sent: Array<{ notifiable: Notifiable; message: unknown; channel: string }> = [];

  constructor(channelName: string = 'array') { this.name = channelName; }

  /**
   * @param {Notifiable} notifiable
   * @param {unknown} message
   * @returns {Promise<void>}
   */
  async send(notifiable: Notifiable, message: unknown): Promise<void> {
    this.sent.push({ notifiable, message, channel: this.name });
  }

  getSent() { return [...this.sent]; }

  /**
   * @param {Notifiable} notifiable
   */
  assertSentTo(notifiable: Notifiable): void {
    const found = this.sent.some((s) => s.notifiable === notifiable);
    if (!found) throw new Error(`No notification sent to the given notifiable via "${this.name}".`);
  }

  /**
   * @param { (msg: unknown) => boolean } predicate
   */
  assertSentWithData(predicate: (msg: unknown) => boolean): void {
    const found = this.sent.some((s) => predicate(s.message));
    if (!found) throw new Error(`No notification matching predicate found on "${this.name}".`);
  }

  /**
   * @param {number} n
   */
  assertCount(n: number): void {
    if (this.sent.length !== n) throw new Error(`Expected ${n} notifications on "${this.name}", got ${this.sent.length}.`);
  }

  assertNothingSent(): void {
    if (this.sent.length > 0) throw new Error(`Expected no notifications on "${this.name}", but ${this.sent.length} were sent.`);
  }

  reset(): void { this.sent = []; }
}

// ── DatabaseChannel — stores in-memory (real impl writes to DB) ──

/**
 * InMemoryDatabaseChannel — stores notification delivery records in memory.
 *
 * Useful for unit/integration tests that need to assert:
 * - per-notifiable queries (`forNotifiable()`)
 * - unread vs read state (`unreadFor()`)
 * - marking notifications as read (`markAsRead()`)
 *
 * @example
 * ```ts
 * const manager = new NotificationManager().channel('database', new InMemoryDatabaseChannel());
 *
 * class User implements Notifiable {
 *   constructor(public id: string) {}
 *   routeNotificationFor(_channel: string) { return this.id; }
 * }
 *
 * class OrderCreated extends BaseNotification<{ orderId: number }> {
 *   via() { return ['database']; }
 *   toDatabase() {
 *     return { type: 'order.created', data: { orderId: this.data.orderId }, readAt: null };
 *   }
 * }
 *
 * const u = new User('u42');
 * await manager.send(u, new OrderCreated({ orderId: 99 }));
 *
 * const channel = manager.getChannel<InMemoryDatabaseChannel>('database');
 * channel.unreadFor('u42').length; // === 1
 * ```
 */
export class InMemoryDatabaseChannel implements INotificationChannel<DatabaseChannelMessage> {
  readonly name = 'database';
  private records: Array<{ notifiableId: string | null; type: string; data: Record<string, unknown>; readAt: Date | null; createdAt: Date }> = [];

  /**
   * @param {Notifiable} notifiable
   * @param {DatabaseChannelMessage} message
   * @returns {Promise<void>}
   */
  async send(notifiable: Notifiable, message: DatabaseChannelMessage): Promise<void> {
    this.records.push({
      notifiableId: notifiable.routeNotificationFor('database'),
      type: message.type,
      data: message.data,
      readAt: message.readAt ?? null,
      createdAt: new Date(),
    });
  }

  /** Get all notifications for a notifiable */
  /**
   * @param {string} id
   * @returns {typeof this.records}
   */
  forNotifiable(id: string): typeof this.records {
    return this.records.filter((r) => r.notifiableId === id);
  }

  /** Get unread notifications for a notifiable */
  /**
   * @param {string} id
   * @returns {typeof this.records}
   */
  unreadFor(id: string): typeof this.records {
    return this.records.filter((r) => r.notifiableId === id && r.readAt === null);
  }

  /** Mark all as read */
  /**
   * @param {string} id
   */
  markAsRead(id: string): void {
    for (const r of this.records) {
      if (r.notifiableId === id) r.readAt = new Date();
    }
  }

  getAll() { return [...this.records]; }
  reset(): void { this.records = []; }
}

// ── NotificationManager — routes notifications to channels ──
