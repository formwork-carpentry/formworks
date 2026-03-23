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
import { createHmac, timingSafeEqual } from 'node:crypto';

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

    const headers = normalizeHeaders(request.headers);
    const body = toBuffer(request.body);

    if (!verifySignature(provider, config, body, headers)) {
      return false;
    }

    const payloadBody = parseBody(body);
    const payload: WebhookPayload = {
      provider,
      event: resolveEvent(provider, payloadBody, headers),
      body: payloadBody,
      headers,
      timestamp: resolveTimestamp(headers),
      deliveryId: resolveDeliveryId(provider, headers),
    };

    const directHandlers = this.handlers.get(`${provider}:${payload.event}`) ?? [];
    const catchAllHandlers = this.catchAllHandlers.get(provider) ?? [];

    for (const handler of [...directHandlers, ...catchAllHandlers]) {
      await handler(payload);
    }

    return true;
  }
}

function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

function toBuffer(body: string | Buffer): Buffer {
  return typeof body === 'string' ? Buffer.from(body, 'utf-8') : body;
}

function parseBody(body: Buffer): unknown {
  const text = body.toString('utf-8');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function verifySignature(
  provider: string,
  config: WebhookProviderConfig,
  body: Buffer,
  headers: Record<string, string>,
): boolean {
  switch (provider) {
    case 'stripe':
      return verifyStripeSignature(config, body, headers);
    case 'github':
      return verifyGithubSignature(config, body, headers);
    case 'shopify':
      return verifyShopifySignature(config, body, headers);
    default:
      return verifyGenericSignature(config, body, headers);
  }
}

function verifyStripeSignature(
  config: WebhookProviderConfig,
  body: Buffer,
  headers: Record<string, string>,
): boolean {
  const header = headers[config.signatureHeader?.toLowerCase() ?? 'stripe-signature'];
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [k, ...rest] = part.split('=');
      return [k?.trim() ?? '', rest.join('=').trim()];
    }),
  );

  const timestamp = Number(parts.t);
  const signatureValues = header
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.startsWith('v1='))
    .map((segment) => segment.slice(3));

  if (!Number.isFinite(timestamp) || signatureValues.length === 0) {
    return false;
  }

  const tolerance = config.tolerance ?? 300;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > tolerance) {
    return false;
  }

  const payload = `${timestamp}.${body.toString('utf-8')}`;
  const expected = createHmac('sha256', config.secret).update(payload).digest('hex');
  return signatureValues.some((signature) => secureCompareHex(expected, signature));
}

function verifyGithubSignature(
  config: WebhookProviderConfig,
  body: Buffer,
  headers: Record<string, string>,
): boolean {
  const header = headers[config.signatureHeader?.toLowerCase() ?? 'x-hub-signature-256'];
  if (!header || !header.startsWith('sha256=')) return false;

  const actual = header.slice('sha256='.length);
  const expected = createHmac('sha256', config.secret).update(body).digest('hex');
  return secureCompareHex(expected, actual);
}

function verifyShopifySignature(
  config: WebhookProviderConfig,
  body: Buffer,
  headers: Record<string, string>,
): boolean {
  const header = headers[config.signatureHeader?.toLowerCase() ?? 'x-shopify-hmac-sha256'];
  if (!header) return false;

  const expected = createHmac('sha256', config.secret).update(body).digest('base64');
  return secureCompareText(expected, header);
}

function verifyGenericSignature(
  config: WebhookProviderConfig,
  body: Buffer,
  headers: Record<string, string>,
): boolean {
  const headerName = config.signatureHeader?.toLowerCase() ?? 'x-webhook-signature';
  const header = headers[headerName];
  if (!header) return false;

  const actual = header.startsWith('sha256=') ? header.slice('sha256='.length) : header;
  const expected = createHmac('sha256', config.secret).update(body).digest('hex');
  return secureCompareHex(expected, actual);
}

function secureCompareHex(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  return secureCompareText(expected.toLowerCase(), actual.toLowerCase());
}

function secureCompareText(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf-8');
  const actualBuffer = Buffer.from(actual, 'utf-8');
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function resolveEvent(
  provider: string,
  body: unknown,
  headers: Record<string, string>,
): string {
  if (provider === 'github' && headers['x-github-event']) {
    return headers['x-github-event'];
  }

  if (provider === 'shopify' && headers['x-shopify-topic']) {
    return headers['x-shopify-topic'];
  }

  if (typeof body === 'object' && body !== null) {
    const maybeObject = body as Record<string, unknown>;
    const candidate = maybeObject.type ?? maybeObject.event;
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return headers['x-event'] ?? headers['x-webhook-event'] ?? 'unknown';
}

function resolveTimestamp(headers: Record<string, string>): Date | undefined {
  const raw = headers['x-timestamp'] ?? headers['x-webhook-timestamp'] ?? headers['x-signature-timestamp'];
  if (!raw) return undefined;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    // Heuristic: webhook timestamps are usually seconds, but some providers send millis.
    return new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric);
  }
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }
  return undefined;
}

function resolveDeliveryId(provider: string, headers: Record<string, string>): string | undefined {
  if (provider === 'github') {
    return headers['x-github-delivery'];
  }
  if (provider === 'shopify') {
    return headers['x-shopify-webhook-id'];
  }
  return headers['x-delivery-id'] ?? headers['x-webhook-id'];
}
