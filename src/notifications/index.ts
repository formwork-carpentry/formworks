/**
 * @module @carpentry/notifications
 * @description Notifications — re-exports.
 *
 * Use this package to:
 * - Dispatch domain events to different delivery channels (mail, sms, database, webhook)
 * - Build typed notifications by extending {@link BaseNotification}
 * - Route recipients via {@link Notifiable} implementations (channel lookup)
 *
 * @example
 * ```ts
 * import { NotificationManager, BaseNotification, ArrayChannel } from './';
 *
 * class User {
 *   constructor(public email: string) {}
 *   routeNotificationFor(channel: string): string | null {
 *     return channel === 'mail' ? this.email : null;
 *   }
 * }
 *
 * class WelcomeNotification extends BaseNotification {
 *   via() { return ['array']; }
 *   toArray() { return { message: 'Welcome!' }; }
 * }
 *
 * const manager = new NotificationManager()
 *   .channel('array', new ArrayChannel('array'));
 *
 * await manager.send(new User('a@example.com'), new WelcomeNotification(null));
 * ```
 *
 * @see NotificationManager — Channel routing and dispatch
 * @see BaseNotification — Notification payload + channel declarations
 */

export * from "./types.js";
export * from "./channels.js";
export * from "./manager.js";
