/**
 * @module @carpentry/core/contracts/webhook
 * @description Webhook contract — receiving, verifying, and dispatching webhook events.
 *
 * Implementations: StandardWebhookReceiver
 *
 * @example
 * ```ts
 * const webhooks = container.make<IWebhookReceiver>('webhook');
 * webhooks.on('stripe', 'payment_intent.succeeded', async (payload) => {
 *   await processPayment(payload);
 * });
 *
 * // In HTTP handler:
 * await webhooks.handle('stripe', request);
 * ```
 */

/** A verified webhook payload. */
export interface WebhookPayload {
  /** Provider name (e.g., 'stripe', 'github', 'shopify') */
  provider: string;
  /** Event type (e.g., 'payment_intent.succeeded') */
  event: string;
  /** The raw payload body */
  body: unknown;
  /** Parsed headers relevant to verification */
  headers: Record<string, string>;
  /** Timestamp of the webhook (from the provider) */
  timestamp?: Date;
  /** Unique delivery ID */
  deliveryId?: string;
}

/** Configuration for a webhook provider. */
export interface WebhookProviderConfig {
  /** Provider name */
  name: string;
  /** Secret for signature verification */
  secret: string;
  /** Signature header name (e.g., 'stripe-signature') */
  signatureHeader?: string;
  /** Tolerance in seconds for timestamp validation (default: 300) */
  tolerance?: number;
}

/** Handler function for a webhook event. */
export type WebhookHandler = (payload: WebhookPayload) => Promise<void>;

/** @typedef {Object} IWebhookReceiver - Webhook receiver contract */
export interface IWebhookReceiver {
  /** Register a handler for a specific provider + event combination. */
  on(provider: string, event: string, handler: WebhookHandler): void;

  /** Register a catch-all handler for any event from a provider. */
  onAny(provider: string, handler: WebhookHandler): void;

  /**
   * Verify and dispatch an incoming webhook request.
   * @param {string} provider - Provider name to route to
   * @param {object} request - Incoming request with body, headers
   * @returns {Promise<boolean>} True if the webhook was valid and dispatched
   */
  handle(
    provider: string,
    request: { body: string | Buffer; headers: Record<string, string> },
  ): Promise<boolean>;
}
