/**
 * @module @carpentry/billing
 * @description InMemoryPaymentProvider — test/mock payment provider
 * @patterns Strategy (implements IPaymentProvider)
 */

import type {
  IPaymentProvider, Customer, Charge, ChargeOptions, Refund, Subscription, SubscriptionOptions,
  Plan, Invoice, PaymentMethod, Money,
  WebhookEventType, WebhookEvent, WebhookHandler,
} from './types.js';

/**
 * In-memory `IPaymentProvider` for tests: customers, charges, subscriptions, invoices, and webhooks.
 *
 * @example
 * ```ts
 * import { InMemoryPaymentProvider } from '@carpentry/billing';
 *
 * const provider = new InMemoryPaymentProvider();
 * await provider.addPlan({
 *   id: 'pro',
 *   name: 'Pro',
 *   amount: { amount: 2000, currency: 'USD' },
 *   interval: 'month',
 *   intervalCount: 1,
 * });
 * const customer = await provider.createCustomer('bob@example.com');
 * await provider.charge(customer.id, { amount: 2000, currency: 'USD' });
 * ```
 */
export class InMemoryPaymentProvider implements IPaymentProvider {
  readonly name = 'memory';
  private customers = new Map<string, Customer>();
  private charges = new Map<string, Charge>();
  private refunds = new Map<string, Refund>();
  private subscriptions = new Map<string, Subscription>();
  private invoices = new Map<string, Invoice>();
  private plans = new Map<string, Plan>();
  private webhookEvents: WebhookEvent[] = [];
  private webhookHandlers = new Map<string, WebhookHandler[]>();
  private idCounter = 0;

  /** Register a plan (must be done before subscribe) */
  /**
   * @param {Plan} plan
   * @returns {this}
   */
  addPlan(plan: Plan): this { this.plans.set(plan.id, plan); return this; }

  /** Register a webhook handler */
  /**
   * @param {WebhookEventType} type
   * @param {WebhookHandler} handler
   * @returns {this}
   */
  onWebhook(type: WebhookEventType, handler: WebhookHandler): this {
    if (!this.webhookHandlers.has(type)) this.webhookHandlers.set(type, []);
    this.webhookHandlers.get(type)!.push(handler);
    return this;
  }

  private nextId(prefix: string): string { return `${prefix}_${++this.idCounter}`; }

  // ── Customers ───────────────────────────────────────────

  /**
   * @param {string} email
   * @param {string} [name]
   * @param {Object} [metadata]
   * @returns {Promise<Customer>}
   */
  async createCustomer(email: string, name?: string, metadata?: Record<string, unknown>): Promise<Customer> {
    const customer: Customer = {
      id: this.nextId('cus'), email, name, paymentMethods: [],
      metadata, createdAt: new Date(),
    };
    this.customers.set(customer.id, customer);
    await this.emitWebhook('customer.created', { customer });
    return customer;
  }

  /**
   * @param {string} id
   * @returns {Promise<Customer | null>}
   */
  async getCustomer(id: string): Promise<Customer | null> { return this.customers.get(id) ?? null; }

  /**
   * @param {string} id
   * @param {Partial<{ email: string; name: string; metadata: Object }>} data
   * @returns {Promise<Customer>}
   */
  async updateCustomer(id: string, data: Partial<{ email: string; name: string; metadata: Record<string, unknown> }>): Promise<Customer> {
    const c = this.customers.get(id);
    if (!c) throw new Error(`Customer "${id}" not found.`);
    Object.assign(c, data);
    return c;
  }

  // ── Charges ─────────────────────────────────────────────

  /**
   * @param {string} customerId
   * @param {Money} amount
   * @param {ChargeOptions} [options]
   * @returns {Promise<Charge>}
   */
  async charge(customerId: string, amount: Money, options?: ChargeOptions): Promise<Charge> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error(`Customer "${customerId}" not found.`);

    const charge: Charge = {
      id: this.nextId('ch'), customerId, amount, status: 'succeeded',
      paymentMethodId: options?.paymentMethodId, description: options?.description,
      metadata: options?.metadata, createdAt: new Date(),
    };
    this.charges.set(charge.id, charge);
    await this.emitWebhook('charge.succeeded', { charge });
    return charge;
  }

  /**
   * @param {string} id
   * @returns {Promise<Charge | null>}
   */
  async getCharge(id: string): Promise<Charge | null> { return this.charges.get(id) ?? null; }

  // ── Refunds ─────────────────────────────────────────────

  /**
   * @param {string} chargeId
   * @param {Money} [amount]
   * @param {string} [reason]
   * @returns {Promise<Refund>}
   */
  async refund(chargeId: string, amount?: Money, reason?: string): Promise<Refund> {
    const charge = this.charges.get(chargeId);
    if (!charge) throw new Error(`Charge "${chargeId}" not found.`);

    const refundAmount = amount ?? charge.amount;
    const refund: Refund = {
      id: this.nextId('re'), chargeId, amount: refundAmount,
      status: 'succeeded', reason, createdAt: new Date(),
    };
    this.refunds.set(refund.id, refund);

    charge.status = refundAmount.amount >= charge.amount.amount ? 'refunded' : 'partially_refunded';
    charge.refundedAmount = refundAmount;
    await this.emitWebhook('charge.refunded', { charge, refund });
    return refund;
  }

  // ── Subscriptions ───────────────────────────────────────

  /**
   * @param {string} customerId
   * @param {string} planId
   * @param {SubscriptionOptions} [options]
   * @returns {Promise<Subscription>}
   */
  async subscribe(customerId: string, planId: string, options?: SubscriptionOptions): Promise<Subscription> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error(`Customer "${customerId}" not found.`);
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan "${planId}" not found.`);

    const now = new Date();
    const trialDays = options?.trialDays ?? plan.trialDays ?? 0;
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + (plan.interval === 'month' ? 30 : plan.interval === 'year' ? 365 : plan.intervalCount));

    const sub: Subscription = {
      id: this.nextId('sub'), customerId, planId,
      status: trialDays > 0 ? 'trialing' : 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt: trialDays > 0 ? new Date(now.getTime() + trialDays * 86400000) : undefined,
      canceledAt: undefined, cancelAtPeriodEnd: false,
      metadata: options?.metadata, createdAt: now,
    };
    this.subscriptions.set(sub.id, sub);

    // Create invoice
    const invoice: Invoice = {
      id: this.nextId('inv'), customerId, subscriptionId: sub.id,
      status: trialDays > 0 ? 'draft' : 'paid',
      lineItems: [{ description: plan.name, quantity: 1, unitAmount: plan.amount, amount: plan.amount }],
      subtotal: plan.amount, tax: { amount: 0, currency: plan.amount.currency }, total: plan.amount,
      paidAt: trialDays > 0 ? undefined : now, dueDate: periodEnd, createdAt: now,
    };
    this.invoices.set(invoice.id, invoice);

    await this.emitWebhook('subscription.created', { subscription: sub });
    return sub;
  }

  /**
   * @param {string} subscriptionId
   * @param {boolean} [atPeriodEnd]
   * @returns {Promise<Subscription>}
   */
  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = true): Promise<Subscription> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) throw new Error(`Subscription "${subscriptionId}" not found.`);

    if (atPeriodEnd) {
      sub.cancelAtPeriodEnd = true;
    } else {
      sub.status = 'canceled';
      sub.canceledAt = new Date();
    }
    await this.emitWebhook('subscription.canceled', { subscription: sub });
    return sub;
  }

  /**
   * @param {string} subscriptionId
   * @returns {Promise<Subscription>}
   */
  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) throw new Error(`Subscription "${subscriptionId}" not found.`);
    if (sub.status === 'canceled') throw new Error('Cannot resume a fully canceled subscription.');

    sub.cancelAtPeriodEnd = false;
    sub.status = 'active';
    return sub;
  }

  /**
   * @param {string} id
   * @returns {Promise<Subscription | null>}
   */
  async getSubscription(id: string): Promise<Subscription | null> { return this.subscriptions.get(id) ?? null; }

  // ── Payment Methods ─────────────────────────────────────

  /**
   * @param {string} customerId
   * @param {Omit<PaymentMethod, 'id' | 'isDefault'>} method
   * @returns {Promise<PaymentMethod>}
   */
  async addPaymentMethod(customerId: string, method: Omit<PaymentMethod, 'id' | 'isDefault'>): Promise<PaymentMethod> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error(`Customer "${customerId}" not found.`);

    const pm: PaymentMethod = { id: this.nextId('pm'), isDefault: customer.paymentMethods.length === 0, ...method };
    customer.paymentMethods.push(pm);
    if (pm.isDefault) customer.defaultPaymentMethodId = pm.id;
    return pm;
  }

  /**
   * @param {string} customerId
   * @param {string} paymentMethodId
   * @returns {Promise<void>}
   */
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error(`Customer "${customerId}" not found.`);
    for (const pm of customer.paymentMethods) pm.isDefault = pm.id === paymentMethodId;
    customer.defaultPaymentMethodId = paymentMethodId;
  }

  // ── Invoices ────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {Promise<Invoice | null>}
   */
  async getInvoice(id: string): Promise<Invoice | null> { return this.invoices.get(id) ?? null; }

  /**
   * @param {string} customerId
   * @returns {Promise<Invoice[]>}
   */
  async getInvoicesForCustomer(customerId: string): Promise<Invoice[]> {
    return [...this.invoices.values()].filter((i) => i.customerId === customerId);
  }

  // ── Webhook Simulation ──────────────────────────────────

  private async emitWebhook(type: WebhookEventType, payload: Record<string, unknown>): Promise<void> {
    const event: WebhookEvent = { id: this.nextId('evt'), type, payload, createdAt: new Date() };
    this.webhookEvents.push(event);
    const handlers = this.webhookHandlers.get(type) ?? [];
    for (const h of handlers) await h(event);
  }

  // ── Test Assertions ─────────────────────────────────────

  getWebhookEvents(): WebhookEvent[] { return [...this.webhookEvents]; }

  /**
   * @param {string} customerId
   * @param {number} [amountCents]
   */
  assertCharged(customerId: string, amountCents?: number): void {
    const charges = [...this.charges.values()].filter((c) =>
      c.customerId === customerId && (amountCents === undefined || c.amount.amount === amountCents)
    );
    if (charges.length === 0) throw new Error(`No charge found for customer "${customerId}"${amountCents !== undefined ? ` of ${amountCents} cents` : ''}.`);
  }

  /**
   * @param {string} chargeId
   */
  assertRefunded(chargeId: string): void {
    const charge = this.charges.get(chargeId);
    if (!charge || (charge.status !== 'refunded' && charge.status !== 'partially_refunded')) {
      throw new Error(`Charge "${chargeId}" was not refunded.`);
    }
  }

  /**
   * @param {string} customerId
   * @param {string} [planId]
   */
  assertSubscribed(customerId: string, planId?: string): void {
    const subs = [...this.subscriptions.values()].filter((s) =>
      s.customerId === customerId && (planId === undefined || s.planId === planId) &&
      (s.status === 'active' || s.status === 'trialing')
    );
    if (subs.length === 0) throw new Error(`No active subscription for customer "${customerId}"${planId ? ` on plan "${planId}"` : ''}.`);
  }

  /**
   * @param {WebhookEventType} type
   */
  assertWebhookFired(type: WebhookEventType): void {
    if (!this.webhookEvents.some((e) => e.type === type)) {
      throw new Error(`Expected webhook "${type}" but none fired.`);
    }
  }

  /**
   * @param {string} customerId
   * @param {number} count
   */
  assertInvoiceCount(customerId: string, count: number): void {
    const invoices = [...this.invoices.values()].filter((i) => i.customerId === customerId);
    if (invoices.length !== count) throw new Error(`Expected ${count} invoices for "${customerId}", got ${invoices.length}.`);
  }

  reset(): void {
    this.customers.clear(); this.charges.clear(); this.refunds.clear();
    this.subscriptions.clear(); this.invoices.clear(); this.webhookEvents = [];
    this.idCounter = 0;
  }
}

// ── Billable Trait (mixin for models) ─────────────────────

export interface Billable {
  getPaymentCustomerId(): string | null;
  /**
   * @param {string} id
   */
  setPaymentCustomerId(id: string): void;
}

// ── Billing Facade ────────────────────────────────────────

let globalProvider: IPaymentProvider | null = null;
/**
 * @param {IPaymentProvider} p
 */
export function setBillingProvider(p: IPaymentProvider): void { globalProvider = p; }

export const Billing = {
  charge: (customerId: string, amount: Money, opts?: ChargeOptions) => getProvider().charge(customerId, amount, opts),
  refund: (chargeId: string, amount?: Money, reason?: string) => getProvider().refund(chargeId, amount, reason),
  subscribe: (customerId: string, planId: string, opts?: SubscriptionOptions) => getProvider().subscribe(customerId, planId, opts),
  cancel: (subId: string, atPeriodEnd?: boolean) => getProvider().cancelSubscription(subId, atPeriodEnd),
  resume: (subId: string) => getProvider().resumeSubscription(subId),
  customer: (id: string) => getProvider().getCustomer(id),
  createCustomer: (email: string, name?: string) => getProvider().createCustomer(email, name),
  invoices: (customerId: string) => getProvider().getInvoicesForCustomer(customerId),
};

function getProvider(): IPaymentProvider {
  /**
   * @param {unknown} !globalProvider
   */
  if (!globalProvider) throw new Error('Billing provider not initialized.');
  return globalProvider;
}
