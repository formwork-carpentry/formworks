/**
 * @module @formwork/billing
 * @description Payment and subscription management.
 *
 * Use this package to:
 * - Model customers, one-off charges, refunds, and subscriptions
 * - Swap the payment gateway via an {@link IPaymentProvider} implementation
 * - Test billing flows with {@link InMemoryPaymentProvider}
 *
 * @example
 * ```ts
 * import { InMemoryPaymentProvider } from '@formwork/billing';
 *
 * const provider = new InMemoryPaymentProvider();
 *
 * await provider.addPlan({
 *   id: 'basic',
 *   name: 'Basic',
 *   amount: { amount: 5000, currency: 'USD' },
 *   interval: 'month',
 *   intervalCount: 1,
 *   trialDays: 14,
 * });
 *
 * const customer = await provider.createCustomer('alice@example.com', 'Alice');
 *
 * // One-off charge
 * const charge = await provider.charge(customer.id, { amount: 5000, currency: 'USD' });
 *
 * // Subscribe on a plan (creates an invoice)
 * const sub = await provider.subscribe(customer.id, 'basic', { trialDays: 14 });
 * ```
 *
 * @see IPaymentProvider — Payment gateway contract
 * @see InMemoryPaymentProvider — Built-in provider for tests/dev
 */

export * from './types.js';
export * from './provider.js';
