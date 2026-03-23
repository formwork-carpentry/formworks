import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { WebhookReceiver } from '../src/index.js';

describe('@carpentry/webhook: WebhookReceiver', () => {
  it('verifies and dispatches GitHub webhook handlers', async () => {
    const receiver = new WebhookReceiver();
    receiver.provider('github', { secret: 'top-secret' });

    const specific = vi.fn(async () => {});
    const any = vi.fn(async () => {});

    receiver.on('github', 'push', specific);
    receiver.onAny('github', any);

    const body = JSON.stringify({ ref: 'refs/heads/main' });
    const signature = createHmac('sha256', 'top-secret').update(body).digest('hex');

    const ok = await receiver.handle('github', {
      body,
      headers: {
        'x-hub-signature-256': `sha256=${signature}`,
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-1',
      },
    });

    expect(ok).toBe(true);
    expect(specific).toHaveBeenCalledTimes(1);
    expect(any).toHaveBeenCalledTimes(1);

    const payload = specific.mock.calls[0]?.[0];
    expect(payload.provider).toBe('github');
    expect(payload.event).toBe('push');
    expect(payload.deliveryId).toBe('delivery-1');
  });

  it('rejects invalid signature without dispatching handlers', async () => {
    const receiver = new WebhookReceiver();
    receiver.provider('github', { secret: 'correct-secret' });

    const specific = vi.fn(async () => {});
    receiver.on('github', 'push', specific);

    const ok = await receiver.handle('github', {
      body: JSON.stringify({ ref: 'refs/heads/main' }),
      headers: {
        'x-hub-signature-256': 'sha256=badbadbad',
        'x-github-event': 'push',
      },
    });

    expect(ok).toBe(false);
    expect(specific).not.toHaveBeenCalled();
  });

  it('verifies Stripe signatures with timestamp tolerance', async () => {
    const receiver = new WebhookReceiver();
    receiver.provider('stripe', { secret: 'whsec_123', tolerance: 300 });

    const handler = vi.fn(async () => {});
    receiver.on('stripe', 'payment_intent.succeeded', handler);

    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
    const signedPayload = `${timestamp}.${body}`;
    const signature = createHmac('sha256', 'whsec_123').update(signedPayload).digest('hex');

    const ok = await receiver.handle('stripe', {
      body,
      headers: {
        'stripe-signature': `t=${timestamp},v1=${signature}`,
      },
    });

    expect(ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('throws when provider is not registered', async () => {
    const receiver = new WebhookReceiver();

    await expect(
      receiver.handle('stripe', {
        body: '{}',
        headers: {},
      }),
    ).rejects.toThrow('Unknown webhook provider');
  });
});
