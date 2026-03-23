import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryPaymentProvider, setBillingProvider, Billing } from '../src/index.js';
import type { Plan } from '../src/index.js';

const monthlyPlan: Plan = {
  id: 'plan_monthly', name: 'Pro Monthly',
  amount: { amount: 2999, currency: 'USD' },
  interval: 'month', intervalCount: 1, trialDays: 14,
  features: ['unlimited-projects', 'priority-support'],
};

const yearlyPlan: Plan = {
  id: 'plan_yearly', name: 'Pro Yearly',
  amount: { amount: 29900, currency: 'USD' },
  interval: 'year', intervalCount: 1,
};

describe('@carpentry/billing: InMemoryPaymentProvider', () => {
  let provider: InMemoryPaymentProvider;

  beforeEach(() => {
    provider = new InMemoryPaymentProvider();
    provider.addPlan(monthlyPlan).addPlan(yearlyPlan);
  });

  describe('customers', () => {
    it('creates a customer', async () => {
      const customer = await provider.createCustomer('alice@example.com', 'Alice');
      expect(customer.id).toBeTruthy();
      expect(customer.email).toBe('alice@example.com');
      expect(customer.name).toBe('Alice');
    });

    it('retrieves a customer', async () => {
      const created = await provider.createCustomer('alice@example.com');
      const found = await provider.getCustomer(created.id);
      expect(found).not.toBeNull();
      expect(found!.email).toBe('alice@example.com');
    });

    it('returns null for unknown customer', async () => {
      expect(await provider.getCustomer('cus_nonexistent')).toBeNull();
    });

    it('updates a customer', async () => {
      const c = await provider.createCustomer('old@example.com');
      const updated = await provider.updateCustomer(c.id, { email: 'new@example.com', name: 'Updated' });
      expect(updated.email).toBe('new@example.com');
      expect(updated.name).toBe('Updated');
    });
  });

  describe('charges', () => {
    it('creates a successful charge', async () => {
      const customer = await provider.createCustomer('alice@example.com');
      const charge = await provider.charge(customer.id, { amount: 5000, currency: 'USD' }, { description: 'One-time fee' });

      expect(charge.status).toBe('succeeded');
      expect(charge.amount.amount).toBe(5000);
      expect(charge.description).toBe('One-time fee');
      provider.assertCharged(customer.id, 5000);
    });

    it('throws for unknown customer', async () => {
      await expect(provider.charge('cus_fake', { amount: 1000, currency: 'USD' }))
        .rejects.toThrow('not found');
    });

    it('retrieves a charge', async () => {
      const c = await provider.createCustomer('a@b.com');
      const charge = await provider.charge(c.id, { amount: 1000, currency: 'USD' });
      const found = await provider.getCharge(charge.id);
      expect(found!.amount.amount).toBe(1000);
    });

    it('fires charge.succeeded webhook', async () => {
      const c = await provider.createCustomer('a@b.com');
      await provider.charge(c.id, { amount: 1000, currency: 'USD' });
      provider.assertWebhookFired('charge.succeeded');
    });
  });

  describe('refunds', () => {
    it('full refund', async () => {
      const c = await provider.createCustomer('a@b.com');
      const charge = await provider.charge(c.id, { amount: 5000, currency: 'USD' });
      const refund = await provider.refund(charge.id);

      expect(refund.status).toBe('succeeded');
      expect(refund.amount.amount).toBe(5000);

      const updatedCharge = await provider.getCharge(charge.id);
      expect(updatedCharge!.status).toBe('refunded');
      provider.assertRefunded(charge.id);
    });

    it('partial refund', async () => {
      const c = await provider.createCustomer('a@b.com');
      const charge = await provider.charge(c.id, { amount: 5000, currency: 'USD' });
      await provider.refund(charge.id, { amount: 2000, currency: 'USD' });

      const updated = await provider.getCharge(charge.id);
      expect(updated!.status).toBe('partially_refunded');
      expect(updated!.refundedAmount!.amount).toBe(2000);
    });

    it('fires charge.refunded webhook', async () => {
      const c = await provider.createCustomer('a@b.com');
      const charge = await provider.charge(c.id, { amount: 1000, currency: 'USD' });
      await provider.refund(charge.id);
      provider.assertWebhookFired('charge.refunded');
    });
  });

  describe('subscriptions', () => {
    it('creates a subscription with trial', async () => {
      const c = await provider.createCustomer('a@b.com');
      const sub = await provider.subscribe(c.id, 'plan_monthly');

      expect(sub.status).toBe('trialing'); // plan has 14 day trial
      expect(sub.planId).toBe('plan_monthly');
      expect(sub.trialEndsAt).toBeDefined();
      expect(sub.cancelAtPeriodEnd).toBe(false);
      provider.assertSubscribed(c.id, 'plan_monthly');
    });

    it('creates subscription without trial', async () => {
      const c = await provider.createCustomer('a@b.com');
      const sub = await provider.subscribe(c.id, 'plan_yearly');
      expect(sub.status).toBe('active'); // yearly has no trial
    });

    it('overrides trial days', async () => {
      const c = await provider.createCustomer('a@b.com');
      const sub = await provider.subscribe(c.id, 'plan_monthly', { trialDays: 0 });
      expect(sub.status).toBe('active'); // trial overridden to 0
    });

    it('cancel at period end', async () => {
      const c = await provider.createCustomer('a@b.com');
      const sub = await provider.subscribe(c.id, 'plan_yearly');
      const canceled = await provider.cancelSubscription(sub.id, true);

      expect(canceled.cancelAtPeriodEnd).toBe(true);
      expect(canceled.status).toBe('active'); // still active until period ends
    });

    it('cancel immediately', async () => {
      const c = await provider.createCustomer('a@b.com');
      const sub = await provider.subscribe(c.id, 'plan_yearly');
      const canceled = await provider.cancelSubscription(sub.id, false);

      expect(canceled.status).toBe('canceled');
      expect(canceled.canceledAt).toBeDefined();
    });

    it('resume a cancel-at-period-end subscription', async () => {
      const c = await provider.createCustomer('a@b.com');
      const sub = await provider.subscribe(c.id, 'plan_yearly');
      await provider.cancelSubscription(sub.id, true);
      const resumed = await provider.resumeSubscription(sub.id);

      expect(resumed.cancelAtPeriodEnd).toBe(false);
      expect(resumed.status).toBe('active');
    });

    it('cannot resume fully canceled subscription', async () => {
      const c = await provider.createCustomer('a@b.com');
      const sub = await provider.subscribe(c.id, 'plan_yearly');
      await provider.cancelSubscription(sub.id, false);

      await expect(provider.resumeSubscription(sub.id)).rejects.toThrow('Cannot resume');
    });

    it('fires subscription.created webhook', async () => {
      const c = await provider.createCustomer('a@b.com');
      await provider.subscribe(c.id, 'plan_yearly');
      provider.assertWebhookFired('subscription.created');
    });

    it('throws for unknown plan', async () => {
      const c = await provider.createCustomer('a@b.com');
      await expect(provider.subscribe(c.id, 'plan_fake')).rejects.toThrow('not found');
    });
  });

  describe('payment methods', () => {
    it('adds a payment method', async () => {
      const c = await provider.createCustomer('a@b.com');
      const pm = await provider.addPaymentMethod(c.id, { type: 'card', last4: '4242', brand: 'visa' });

      expect(pm.id).toBeTruthy();
      expect(pm.last4).toBe('4242');
      expect(pm.isDefault).toBe(true); // first method is default

      const customer = await provider.getCustomer(c.id);
      expect(customer!.paymentMethods).toHaveLength(1);
    });

    it('second method is not default', async () => {
      const c = await provider.createCustomer('a@b.com');
      await provider.addPaymentMethod(c.id, { type: 'card', last4: '4242' });
      const pm2 = await provider.addPaymentMethod(c.id, { type: 'card', last4: '5555' });

      expect(pm2.isDefault).toBe(false);
    });

    it('setDefaultPaymentMethod()', async () => {
      const c = await provider.createCustomer('a@b.com');
      const pm1 = await provider.addPaymentMethod(c.id, { type: 'card', last4: '4242' });
      const pm2 = await provider.addPaymentMethod(c.id, { type: 'card', last4: '5555' });

      await provider.setDefaultPaymentMethod(c.id, pm2.id);
      const customer = await provider.getCustomer(c.id);
      expect(customer!.defaultPaymentMethodId).toBe(pm2.id);
    });
  });

  describe('invoices', () => {
    it('subscription creates an invoice', async () => {
      const c = await provider.createCustomer('a@b.com');
      await provider.subscribe(c.id, 'plan_yearly');

      const invoices = await provider.getInvoicesForCustomer(c.id);
      expect(invoices).toHaveLength(1);
      expect(invoices[0].total.amount).toBe(29900);
      expect(invoices[0].status).toBe('paid');
      provider.assertInvoiceCount(c.id, 1);
    });

    it('trial subscription invoice is draft', async () => {
      const c = await provider.createCustomer('a@b.com');
      await provider.subscribe(c.id, 'plan_monthly'); // has trial

      const invoices = await provider.getInvoicesForCustomer(c.id);
      expect(invoices[0].status).toBe('draft');
    });
  });

  describe('webhooks', () => {
    it('onWebhook() receives events', async () => {
      const events: string[] = [];
      provider.onWebhook('charge.succeeded', async (e) => { events.push(e.type); });
      provider.onWebhook('subscription.created', async (e) => { events.push(e.type); });

      const c = await provider.createCustomer('a@b.com');
      await provider.charge(c.id, { amount: 1000, currency: 'USD' });
      await provider.subscribe(c.id, 'plan_yearly');

      expect(events).toContain('charge.succeeded');
      expect(events).toContain('subscription.created');
    });

    it('getWebhookEvents() returns all fired events', async () => {
      const c = await provider.createCustomer('a@b.com');
      await provider.charge(c.id, { amount: 1000, currency: 'USD' });

      const events = provider.getWebhookEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'customer.created')).toBe(true);
      expect(events.some((e) => e.type === 'charge.succeeded')).toBe(true);
    });
  });

  describe('reset()', () => {
    it('clears all state', async () => {
      const c = await provider.createCustomer('a@b.com');
      await provider.charge(c.id, { amount: 1000, currency: 'USD' });
      provider.reset();

      expect(await provider.getCustomer(c.id)).toBeNull();
      expect(provider.getWebhookEvents()).toHaveLength(0);
    });
  });
});

describe('@carpentry/billing: Billing facade', () => {
  beforeEach(() => {
    const provider = new InMemoryPaymentProvider();
    provider.addPlan(monthlyPlan);
    setBillingProvider(provider);
  });

  it('Billing.createCustomer + charge', async () => {
    const c = await Billing.createCustomer('test@example.com', 'Test');
    const charge = await Billing.charge(c.id, { amount: 2500, currency: 'USD' });
    expect(charge.status).toBe('succeeded');
  });

  it('Billing.subscribe + cancel', async () => {
    const c = await Billing.createCustomer('test@example.com');
    const sub = await Billing.subscribe(c.id, 'plan_monthly');
    expect(sub.status).toBe('trialing');

    const canceled = await Billing.cancel(sub.id);
    expect(canceled.cancelAtPeriodEnd).toBe(true);
  });

  it('Billing.invoices()', async () => {
    const c = await Billing.createCustomer('test@example.com');
    await Billing.subscribe(c.id, 'plan_monthly');
    const invoices = await Billing.invoices(c.id);
    expect(invoices).toHaveLength(1);
  });
});
