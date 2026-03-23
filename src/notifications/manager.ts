/**
 * @module @carpentry/notifications
 * @description NotificationManager and global facades
 * @patterns Mediator, Facade
 */

import type { INotificationChannel, Notifiable, BaseNotification } from './types.js';
import { ArrayChannel } from './channels.js';

/**
 * Routes notifications to registered channels.
 *
 * A notification declares which channels to deliver to via `notification.via(notifiable)`.
 * `NotificationManager` then resolves and calls the channel's `send()` method.
 *
 * @example
 * ```ts
 * import { NotificationManager, ArrayChannel, BaseNotification } from './';
 *
 * class User {
 *   constructor(public email: string) {}
 *   routeNotificationFor(channel: string): string | null {
 *     return channel === 'array' ? this.email : null;
 *   }
 * }
 *
 * class WelcomeNotification extends BaseNotification {
 *   via() { return ['array']; }
 *   toMail() { return { to: [{ email: 'x' }], subject: 'Welcome' } as any; }
 * }
 *
 * const manager = new NotificationManager();
 * manager.channel('array', new ArrayChannel('array'));
 *
 * await manager.send(new User('a@example.com'), new WelcomeNotification(null));
 * ```
 *
 * @see BaseNotification — Declare channels and channel-specific payloads
 * @see Notifiable — Determine where to deliver
 */
export class NotificationManager {
  private channels = new Map<string, INotificationChannel>();
  private globalMiddleware: Array<(n: BaseNotification, channel: string, notifiable: Notifiable) => boolean> = [];

  /** Register a channel */
  /**
   * @param {string} name
   * @param {INotificationChannel} adapter
   * @returns {this}
   */
  channel(name: string, adapter: INotificationChannel): this {
    this.channels.set(name, adapter);
    return this;
  }

  /** Add middleware that can prevent notifications (rate limiting, quiet hours, etc.) */
  /**
   * @param {Object} fn
   * @returns {this}
   */
  before(fn: (n: BaseNotification, channel: string, notifiable: Notifiable) => boolean): this {
    this.globalMiddleware.push(fn);
    return this;
  }

  /** Send a notification to a notifiable through its declared channels */
  /**
   * @param {Notifiable} notifiable
   * @param {BaseNotification} notification
   * @returns {Promise<void>}
   */
  async send(notifiable: Notifiable, notification: BaseNotification): Promise<void> {
    const channels = notification.via(notifiable);

    for (const channelName of channels) {
      // Run middleware — return false to skip this channel
      const proceed = this.globalMiddleware.every((fn) => fn(notification, channelName, notifiable));
      if (!proceed) continue;

      const channel = this.channels.get(channelName);
      if (!channel) {
        throw new Error(`Notification channel "${channelName}" is not registered. Available: ${[...this.channels.keys()].join(', ')}`);
      }

      // Resolve the message for this channel
      const message = this.resolveMessage(notification, channelName, notifiable);
      await channel.send(notifiable, message);
    }
  }

  /** Send to multiple notifiables */
  /**
   * @param {Notifiable[]} notifiables
   * @param {BaseNotification} notification
   * @returns {Promise<void>}
   */
  async sendBulk(notifiables: Notifiable[], notification: BaseNotification): Promise<void> {
    for (const notifiable of notifiables) {
      await this.send(notifiable, notification);
    }
  }

  /** Get a registered channel */
  /**
   * @param {string} name
   * @returns {T}
   */
  getChannel<T extends INotificationChannel>(name: string): T {
    const ch = this.channels.get(name);
    if (!ch) throw new Error(`Channel "${name}" not registered.`);
    return ch as T;
  }

  /** Replace all channels with ArrayChannels for testing */
  /**
   * @param {string[]} ...channelNames
   * @returns {Map<string, ArrayChannel>}
   */
  fake(...channelNames: string[]): Map<string, ArrayChannel> {
    const fakes = new Map<string, ArrayChannel>();
    const names = channelNames.length > 0 ? channelNames : [...this.channels.keys()];

    for (const name of names) {
      const fake = new ArrayChannel(name);
      this.channels.set(name, fake);
      fakes.set(name, fake);
    }
    return fakes;
  }

  private resolveMessage(notification: BaseNotification, channel: string, notifiable: Notifiable): unknown {
    const methodMap: Record<string, string> = {
      mail: 'toMail',
      sms: 'toSms',
      slack: 'toSlack',
      whatsapp: 'toWhatsApp',
      webhook: 'toWebhook',
      database: 'toDatabase',
    };

    const methodName = methodMap[channel] ?? `to${channel.charAt(0).toUpperCase() + channel.slice(1)}`;
    const method = (notification as unknown as Record<string, unknown>)[methodName];

    if (typeof method === 'function') {
      return method.call(notification, notifiable);
    }

    // Fallback: pass the raw notification data
    return notification.data;
  }
}

// ── Global Facade ─────────────────────────────────────────

let globalNotificationManager: NotificationManager | null = null;

/**
 * @param {NotificationManager} m
 */
export function setNotificationManager(m: NotificationManager): void { globalNotificationManager = m; }

/** Send a notification to a notifiable — global helper */
/**
 * @param {Notifiable} notifiable
 * @param {BaseNotification} notification
 * @returns {Promise<void>}
 */
export async function notify(notifiable: Notifiable, notification: BaseNotification): Promise<void> {
  /**
   * @param {unknown} !globalNotificationManager
   */
  if (!globalNotificationManager) throw new Error('NotificationManager not initialized.');
  return globalNotificationManager.send(notifiable, notification);
}

/** Send a notification to multiple notifiables */
/**
 * @param {Notifiable[]} notifiables
 * @param {BaseNotification} notification
 * @returns {Promise<void>}
 */
export async function notifyAll(notifiables: Notifiable[], notification: BaseNotification): Promise<void> {
  /**
   * @param {unknown} !globalNotificationManager
   */
  if (!globalNotificationManager) throw new Error('NotificationManager not initialized.');
  return globalNotificationManager.sendBulk(notifiables, notification);
}
