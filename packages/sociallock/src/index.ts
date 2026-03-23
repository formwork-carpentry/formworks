/**
 * @module @carpentry/sociallock
 * @description OAuth 2.0 social login (Google, GitHub, Facebook) for Carpenter.
 *
 * Use this package to:
 * - Create OAuth redirect URLs for social providers (`SocialLockService.redirect()`)
 * - Handle OAuth callbacks and exchange codes for tokens (`SocialLockService.callback()`)
 * - Persist/lookup users via your `ISocialUserRepository`
 * - Plug authorization via {@link IAuthGuard}
 *
 * @example
 * ```ts
 * import { SocialLockService } from '@carpentry/sociallock';
 *
 * // deps come from your app (guard/repository/state/provider configs)
 * const service = new SocialLockService({
 *   guard,
 *   userRepository,
 *   stateStore,
 *   providers,
 * });
 *
 * // 1) User clicks "Continue with Google"
 * const { redirectUrl } = await service.redirect('google');
 *
 * // 2) OAuth provider redirects back to your callback route
 * const { user, token } = await service.callback('google', code, state);
 * ```
 */

export type {
  IStateStore,
  ISocialUserRepository,
  OAuthProviderConfig,
  SocialAuthResult,
  SocialRedirectResult,
  SocialLockServiceDependencies,
  SocialUserProfile,
} from './contracts.js';
export { SOCIALLOCK_BINDINGS } from './bindings.js';
export { SocialLockError } from './errors.js';
export type { SocialLockErrorCode } from './errors.js';
export { SocialLockService } from './SocialLockService.js';
export { SocialLockController } from './SocialLockController.js';
export type { SocialLockControllerOptions } from './SocialLockController.js';
export { SocialLockServiceProvider } from './SocialLockServiceProvider.js';
export type { SocialLockServiceProviderOptions } from './SocialLockServiceProvider.js';
export { googleProvider, githubProvider, facebookProvider, microsoftProvider } from './providers/index.js';
export type { BuiltInProvider } from './providers/index.js';
export { MemoryStateStore, generateState } from './state/MemoryStateStore.js';
export { registerSocialLockRoutes } from './routes.js';
export type { SocialLockRouteOptions } from './routes.js';
export {
  InMemorySocialUser,
  InMemorySocialUserRepository,
} from './testing.js';
