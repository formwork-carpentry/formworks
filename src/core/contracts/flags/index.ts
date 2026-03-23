/**
 * @module @carpentry/core/contracts/flags
 * @description Feature flag contracts - feature gating and experimentation.
 *
 * Implementations: InMemoryFlagProvider, Experiment
 *
 * @example
 * ```ts
 * const flags = container.make<IFlagProvider>('flags');
 * if (await flags.isEnabled('new-checkout', { userId: '42' })) {
 *   showNewCheckout();
 * }
 * ```
 */

/** @typedef {Object} IFlagProvider - Feature flag provider contract */
export interface IFlagProvider {
  /**
   * Check if a feature flag is enabled.
   * @param {string} flag - Flag name
   * @param {Record<string, unknown>} [context] - Targeting context (e.g., userId, plan)
   * @returns {Promise<boolean>} True if the flag is enabled for this context
   */
  isEnabled(flag: string, context?: Record<string, unknown>): Promise<boolean>;

  /**
   * Get the value of a feature flag (for multivariate flags).
   * @param {string} flag - Flag name
   * @param {T} defaultValue - Fallback value
   * @param {Record<string, unknown>} [context] - Targeting context
   * @returns {Promise<T>} Flag value
   */
  getValue<T = unknown>(
    flag: string,
    defaultValue: T,
    context?: Record<string, unknown>,
  ): Promise<T>;
}
