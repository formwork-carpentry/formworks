/**
 * @module @carpentry/webhook
 * @description Webhook receiving and dispatching — verifies signatures, parses payloads,
 * and routes events to handlers. Supports Stripe, GitHub, Shopify, and custom providers.
 *
 * Builds on the IWebhookReceiver contract from @carpentry/core/contracts/webhook.
 *
 * @patterns Observer (event → handler routing), Strategy (provider-specific verification)
 * @principles OCP (add providers without modifying core), SRP (webhook concerns only)
 *
 * @example
 * ```ts
 * import { WebhookReceiver } from '@carpentry/webhook';
 *
 * const webhooks = new WebhookReceiver();
 * webhooks.provider('stripe', { secret: process.env.STRIPE_WEBHOOK_SECRET! });
 * webhooks.on('stripe', 'payment_intent.succeeded', async (payload) => {
 *   await processPayment(payload.body);
 * });
 *
 * // In your HTTP handler:
 * app.post('/webhooks/stripe', async (req) => {
 *   await webhooks.handle('stripe', { body: req.rawBody, headers: req.headers });
 * });
 * ```
 */

import type {
  IWebhookReceiver,
  WebhookHandler,
  WebhookPayload,
  WebhookProviderConfig,
} from '@carpentry/core/contracts';

export type {
  IWebhookReceiver,
  WebhookHandler,
  WebhookPayload,
  WebhookProviderConfig,
} from '@carpentry/core/contracts';

/** Webhook receiver with provider registration and event routing. */
export class WebhookReceiver implements IWebhookReceiver {
  private readonly providers = new Map<string, WebhookProviderConfig>();
  private readonly handlers = new Map<string, WebhookHandler[]>();
  private readonly catchAllHandlers = new Map<string, WebhookHandler[]>();

  /** Register a webhook provider with its verification secret. */
  provider(name: string, config: Omit<WebhookProviderConfig, 'name'>): void {
    this.providers.set(name, { name, ...config });
  }

  on(provider: string, event: string, handler: WebhookHandler): void {
    const key = `${provider}:${event}`;
    const existing = this.handlers.get(key) ?? [];
    existing.push(handler);
    this.handlers.set(key, existing);
  }

  onAny(provider: string, handler: WebhookHandler): void {
    const existing = this.catchAllHandlers.get(provider) ?? [];
    existing.push(handler);
    this.catchAllHandlers.set(provider, existing);
  }

  async handle(
    provider: string,
    request: { body: string | Buffer; headers: Record<string, string> },
  ): Promise<boolean> {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Unknown webhook provider: "${provider}". Register it with .provider() first.`);
    }

    // TODO: Implement signature verification per provider
    void request; void config;
    throw new Error('WebhookReceiver.handle() signature verification not yet implemented');
  }
}
