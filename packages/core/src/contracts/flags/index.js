/**
 * @module @formwork/core/contracts/flags
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
export {};
//# sourceMappingURL=index.js.map