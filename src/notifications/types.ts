/**
 * @module @carpentry/notifications
 * @description Notification types, channel interfaces, BaseNotification
 * @patterns Template Method (BaseNotification)
 */

/**
 * @module @carpentry/notifications
 * @description Unified notification system — one Notification, many Channels
 *
 * Architecture:
 *   Notification.via() declares which channels to use
 *   Each channel is a Strategy adapter implementing INotificationChannel
 *   NotificationManager routes the notification to each channel
 *   New channels (Push, Telegram, Discord, Teams) added without touching core
 *
 * @patterns Strategy (channels), Template Method (BaseNotification), Observer (events),
 *           Adapter (each channel normalizes to its transport)
 * @principles OCP — new channels without modifying dispatcher
 *             DIP — app depends on INotificationChannel, never on Twilio/Slack SDK directly
 *             LSP — all channels substitutable via interface
 *             SRP — each channel handles one transport
 *
 * @example
 * ```typescript
 * class OrderShipped extends BaseNotification {
 *   via() { return ['mail', 'sms', 'slack']; }
 *   toMail()  { return { to: [{ email: this.data.email }], subject: 'Order shipped!', html: '...' }; }
 *   toSms()   { return { to: this.data.phone, body: 'Your order has shipped!' }; }
 *   toSlack() { return { channel: '#orders', text: `Order ${this.data.orderId} shipped` }; }
 * }
 *
 * await notify(user, new OrderShipped({ email: 'a@b.com', phone: '+1234', orderId: 99 }));
 * ```
 */

// ── Channel Messages — what each channel receives ─────────

export interface MailChannelMessage {
  to: Array<{ email: string; name?: string }>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  subject: string;
  html: string;
  text?: string;
}

export interface SmsChannelMessage {
  to: string;    // phone number
  body: string;
  from?: string;
}

export interface SlackChannelMessage {
  channel: string;    // #channel or @user
  text: string;
  blocks?: unknown[]; // Slack Block Kit
  username?: string;
  iconEmoji?: string;
}

export interface WhatsAppChannelMessage {
  to: string;         // phone number
  body: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface WebhookChannelMessage {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  body: Record<string, unknown>;
}

export interface DatabaseChannelMessage {
  type: string;
  data: Record<string, unknown>;
  readAt?: Date | null;
}

// ── Channel Interface ─────────────────────────────────────

export interface INotificationChannel<TMessage = unknown> {
  /** Channel name — matches what via() returns */
  readonly name: string;
  /** Send the notification through this channel */
  /**
   * @param {Notifiable} notifiable
   * @param {TMessage} message
   * @returns {Promise<void>}
   */
  send(notifiable: Notifiable, message: TMessage): Promise<void>;
}

/** Any entity that can receive notifications (User, Team, etc.) */
export interface Notifiable {
  /** Route key for a specific channel (e.g., email address, phone number, Slack webhook URL) */
  /**
   * @param {string} channel
   * @returns {string | null}
   */
  routeNotificationFor(channel: string): string | null;
}

// ── BaseNotification — Template Method ────────────────────

export abstract class BaseNotification<T = unknown> {
  public data: T;

  constructor(data: T) {
    this.data = data;
  }

  /** Declare which channels this notification uses */
  abstract via(notifiable: Notifiable): string[];

  // Channel-specific message builders — override the ones you need
  toMail?(_notifiable: Notifiable): MailChannelMessage;
  toSms?(_notifiable: Notifiable): SmsChannelMessage;
  toSlack?(_notifiable: Notifiable): SlackChannelMessage;
  toWhatsApp?(_notifiable: Notifiable): WhatsAppChannelMessage;
  toWebhook?(_notifiable: Notifiable): WebhookChannelMessage;
  toDatabase?(_notifiable: Notifiable): DatabaseChannelMessage;
}

// ── Built-in Channel Adapters ─────────────────────────────
