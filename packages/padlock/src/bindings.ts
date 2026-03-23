/**
 * @module @carpentry/padlock/bindings
 * @description Canonical container tokens used by the Padlock service provider.
 * @patterns Registry
 * @principles SRP - centralizes Padlock container token names in one place for provider and application wiring.
 */

/**
 * Canonical container bindings exposed by the Padlock package.
 */
export const PADLOCK_BINDINGS = {
  service: "padlock.service",
  controller: "padlock.controller",
  guard: "padlock.guard",
  hasher: "padlock.hasher",
  userRepository: "padlock.user-repository",
  tokenStore: "padlock.token-store",
  notifier: "padlock.notifier",
  twoFactorStore: "padlock.two-factor-store",
  lockoutStore: "padlock.lockout-store",
} as const;

/**
 * Union of all supported Padlock container token strings.
 */
export type PadlockBindingToken = (typeof PADLOCK_BINDINGS)[keyof typeof PADLOCK_BINDINGS];
