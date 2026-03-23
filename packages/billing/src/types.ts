/**
 * @module @carpentry/billing
 * @description Billing types, interfaces, and payment provider contract
 */

/**
 * @module @carpentry/billing
 * @description Billing and payments — charges, refunds, subscriptions, invoices
 *
 * Architecture:
 *   IPaymentProvider abstracts the gateway (Stripe, PayPal, Paddle, Braintree)
 *   Subscription manages plan/trial/cancellation lifecycle
 *   Invoice represents a billable event
 *   InMemoryPaymentProvider enables full testing without real payment APIs
 *
 * @patterns Strategy (payment providers), State (subscription lifecycle),
 *           Builder (invoice construction), Adapter (normalize gateway APIs)
 * @principles OCP — new gateways via providers; DIP — app depends on interface
 *             SRP — billing logic separate from gateway communication
 */

// ── Core Types ────────────────────────────────────────────

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | string;

export interface Money {
  amount: number;       // in smallest unit (cents for USD)
  currency: Currency;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal' | 'wallet' | string;
  last4?: string;
  brand?: string;       // visa, mastercard, amex
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  metadata?: Record<string, unknown>;
}

// ── Charge ────────────────────────────────────────────────

export type ChargeStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded' | 'disputed';

export interface Charge {
  id: string;
  customerId: string;
  amount: Money;
  status: ChargeStatus;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  refundedAmount?: Money;
  failureReason?: string;
}

export interface ChargeOptions {
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

// ── Refund ────────────────────────────────────────────────

export type RefundStatus = 'pending' | 'succeeded' | 'failed';

export interface Refund {
  id: string;
  chargeId: string;
  amount: Money;
  status: RefundStatus;
  reason?: string;
  createdAt: Date;
}

// ── Customer ──────────────────────────────────────────────

export interface Customer {
  id: string;
  email: string;
  name?: string;
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ── Subscription ──────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused' | 'incomplete';

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  canceledAt?: Date;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Plan {
  id: string;
  name: string;
  amount: Money;
  interval: 'day' | 'week' | 'month' | 'year';
  intervalCount: number;
  trialDays?: number;
  features?: string[];
  metadata?: Record<string, unknown>;
}

export interface SubscriptionOptions {
  trialDays?: number;
  metadata?: Record<string, unknown>;
  paymentMethodId?: string;
}

// ── Invoice ───────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface Invoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: Money;
  tax: Money;
  total: Money;
  paidAt?: Date;
  dueDate?: Date;
  createdAt: Date;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: Money;
  amount: Money;
}

// ── Webhook ───────────────────────────────────────────────

export type WebhookEventType =
  | 'charge.succeeded' | 'charge.failed' | 'charge.refunded' | 'charge.disputed'
  | 'subscription.created' | 'subscription.updated' | 'subscription.canceled' | 'subscription.trial_ending'
  | 'invoice.created' | 'invoice.paid' | 'invoice.payment_failed'
  | 'customer.created' | 'customer.updated'
  | string;

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export type WebhookHandler = (event: WebhookEvent) => Promise<void>;

// ── Payment Provider Interface ────────────────────────────

export interface IPaymentProvider {
  readonly name: string;

  // Customers
  /**
   * @param {string} email
   * @param {string} [name]
   * @param {Object} [metadata]
   * @returns {Promise<Customer>}
   */
  createCustomer(email: string, name?: string, metadata?: Record<string, unknown>): Promise<Customer>;
  /**
   * @param {string} customerId
   * @returns {Promise<Customer | null>}
   */
  getCustomer(customerId: string): Promise<Customer | null>;
  /**
   * @param {string} customerId
   * @param {Partial<{ email: string; name: string; metadata: Object }>} data
   * @returns {Promise<Customer>}
   */
  updateCustomer(customerId: string, data: Partial<{ email: string; name: string; metadata: Record<string, unknown> }>): Promise<Customer>;

  // Charges
  /**
   * @param {string} customerId
   * @param {Money} amount
   * @param {ChargeOptions} [options]
   * @returns {Promise<Charge>}
   */
  charge(customerId: string, amount: Money, options?: ChargeOptions): Promise<Charge>;
  /**
   * @param {string} chargeId
   * @returns {Promise<Charge | null>}
   */
  getCharge(chargeId: string): Promise<Charge | null>;

  // Refunds
  /**
   * @param {string} chargeId
   * @param {Money} [amount]
   * @param {string} [reason]
   * @returns {Promise<Refund>}
   */
  refund(chargeId: string, amount?: Money, reason?: string): Promise<Refund>;

  // Subscriptions
  /**
   * @param {string} customerId
   * @param {string} planId
   * @param {SubscriptionOptions} [options]
   * @returns {Promise<Subscription>}
   */
  subscribe(customerId: string, planId: string, options?: SubscriptionOptions): Promise<Subscription>;
  /**
   * @param {string} subscriptionId
   * @param {boolean} [atPeriodEnd]
   * @returns {Promise<Subscription>}
   */
  cancelSubscription(subscriptionId: string, atPeriodEnd?: boolean): Promise<Subscription>;
  /**
   * @param {string} subscriptionId
   * @returns {Promise<Subscription>}
   */
  resumeSubscription(subscriptionId: string): Promise<Subscription>;
  /**
   * @param {string} subscriptionId
   * @returns {Promise<Subscription | null>}
   */
  getSubscription(subscriptionId: string): Promise<Subscription | null>;

  // Payment Methods
  /**
   * @param {string} customerId
   * @param {Omit<PaymentMethod, 'id' | 'isDefault'>} method
   * @returns {Promise<PaymentMethod>}
   */
  addPaymentMethod(customerId: string, method: Omit<PaymentMethod, 'id' | 'isDefault'>): Promise<PaymentMethod>;
  /**
   * @param {string} customerId
   * @param {string} paymentMethodId
   * @returns {Promise<void>}
   */
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

  // Invoices
  /**
   * @param {string} invoiceId
   * @returns {Promise<Invoice | null>}
   */
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  /**
   * @param {string} customerId
   * @returns {Promise<Invoice[]>}
   */
  getInvoicesForCustomer(customerId: string): Promise<Invoice[]>;
}

// ── InMemoryPaymentProvider — for testing ─────────────────
