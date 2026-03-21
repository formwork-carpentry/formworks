/**
 * @module @formwork/padlock
 * @description Padlock - higher-level authentication workflows and Fortify-style HTTP integration for Carpenter.
 * @patterns Facade
 * @principles SRP - exports the Padlock package surface while underlying modules keep responsibilities focused.
 */

export type {
  CreatePadlockTokenInput,
  CreatePadlockUserInput,
  IPadlockLockoutStore,
  IPadlockNotifier,
  IPadlockTokenStore,
  IPadlockTwoFactorStore,
  IPadlockUserRepository,
  ITotpProvider,
  PadlockAuthResult,
  PadlockChangePasswordInput,
  PadlockConfig,
  PadlockDispatchResult,
  PadlockLoginInput,
  PadlockPasswordResetInput,
  PadlockPasswordResetRequestInput,
  PadlockRegistrationInput,
  PadlockTokenPurpose,
  PadlockTokenRecord,
  PadlockTwoFactorChallengeResult,
  PadlockTwoFactorSetupResult,
} from "./contracts.js";
export { PADLOCK_BINDINGS } from "./bindings.js";
export type { PadlockBindingToken } from "./bindings.js";
export { PadlockError } from "./errors.js";
export { PadlockService } from "./PadlockService.js";
export type { PadlockServiceDependencies } from "./PadlockService.js";
export { NullPadlockNotifier, PadlockNotifierFake } from "./notifiers.js";
export { PadlockServiceProvider } from "./PadlockServiceProvider.js";
export type { PadlockServiceProviderOptions } from "./PadlockServiceProvider.js";
export { BuiltInTotpProvider } from "./totp/BuiltInTotpProvider.js";
export { MemoryLockoutStore, NullLockoutStore } from "./lockout/index.js";
export { MemoryTwoFactorStore } from "./twofactor/MemoryTwoFactorStore.js";
export {
  InMemoryPadlockUser,
  InMemoryPadlockUserRepository,
  InMemoryPadlockUserRepository as PadlockUserRepositoryFake,
  MemoryPadlockTokenStore,
  MemoryPadlockTokenStore as PadlockTokenStoreFake,
} from "./testing.js";
export { PadlockController, registerPadlockRoutes } from "./http.js";
export type {
  PadlockControllerOptions,
  PadlockRouteOptions,
  PadlockRouteThrottles,
} from "./http.js";
