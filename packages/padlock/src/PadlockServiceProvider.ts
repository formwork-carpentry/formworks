/**
 * @module @formwork/padlock/PadlockServiceProvider
 * @description Service provider that wires Padlock services, controller bindings, and optional default routes.
 * @patterns Service Provider, Facade, Template Method
 * @principles SRP - provider bootstraps Padlock bindings while auth/session/database implementations remain external collaborators.
 */

import { HashManager, MemoryGuard } from "@formwork/auth";
import { type IContainer, ServiceProvider } from "@formwork/core/container";
import type {
  IAuthGuard,
  IAuthenticatable,
  IHashManager,
  IUserProvider,
} from "@formwork/core/contracts";
import type { IContainerResolver, Token } from "@formwork/core/types";
import type { Router } from "@formwork/http";
import { PadlockController } from "./PadlockController.js";
import type { PadlockControllerOptions } from "./PadlockController.js";
import { PadlockService } from "./PadlockService.js";
import { PADLOCK_BINDINGS } from "./bindings.js";
import type {
  IPadlockLockoutStore,
  IPadlockNotifier,
  IPadlockTokenStore,
  IPadlockTwoFactorStore,
  IPadlockUserRepository,
  PadlockConfig,
} from "./contracts.js";
import { NullPadlockNotifier } from "./notifiers.js";
import type { PadlockRouteOptions } from "./routes.js";
import { registerPadlockRoutes } from "./routes.js";
import { MemoryPadlockTokenStore } from "./testing.js";

/**
 * Optional binding overrides and route settings for the Padlock service provider.
 */
export interface PadlockServiceProviderOptions<TUser extends IAuthenticatable = IAuthenticatable> {
  guardToken?: Token<IAuthGuard>;
  hasherToken?: Token<IHashManager>;
  userRepositoryToken?: Token<IPadlockUserRepository<TUser>>;
  tokenStoreToken?: Token<IPadlockTokenStore>;
  notifierToken?: Token<IPadlockNotifier<TUser>>;
  twoFactorStoreToken?: Token<IPadlockTwoFactorStore>;
  lockoutStoreToken?: Token<IPadlockLockoutStore>;
  serviceConfig?: PadlockConfig;
  controllerOptions?: PadlockControllerOptions<TUser>;
  routeOptions?: PadlockRouteOptions | false;
}

interface ResolvedPadlockTokens<TUser extends IAuthenticatable = IAuthenticatable> {
  guard: Token<IAuthGuard>;
  hasher: Token<IHashManager>;
  userRepository: Token<IPadlockUserRepository<TUser>>;
  tokenStore: Token<IPadlockTokenStore>;
  notifier: Token<IPadlockNotifier<TUser>>;
}

/**
 * Provider that exposes Padlock via container bindings and optionally registers the default auth routes.
 *
 * @example
 * ```ts
 * const provider = new PadlockServiceProvider(app, {
 *   userRepositoryToken: 'users',
 *   guardToken: 'auth',
 * });
 * provider.register();
 * provider.boot();
 * ```
 */
export class PadlockServiceProvider<
  TUser extends IAuthenticatable = IAuthenticatable,
> extends ServiceProvider {
  private readonly tokens: ResolvedPadlockTokens<TUser>;

  constructor(
    app: IContainer,
    private readonly options: PadlockServiceProviderOptions<TUser> = {},
  ) {
    super(app);
    this.tokens = {
      guard:
        options.guardToken ??
        selectFirstBoundToken<IAuthGuard>(app, ["auth", "auth.guard"]) ??
        PADLOCK_BINDINGS.guard,
      hasher:
        options.hasherToken ??
        selectFirstBoundToken<IHashManager>(app, ["hash", "hash.manager"]) ??
        PADLOCK_BINDINGS.hasher,
      userRepository: options.userRepositoryToken ?? PADLOCK_BINDINGS.userRepository,
      tokenStore: options.tokenStoreToken ?? PADLOCK_BINDINGS.tokenStore,
      notifier: options.notifierToken ?? PADLOCK_BINDINGS.notifier,
    };
  }

  /**
   * Register Padlock workflow bindings and sensible local defaults.
   */
  register(): void {
    this.registerDefaultHasher();
    this.registerDefaultTokenStore();
    this.registerDefaultNotifier();
    this.registerDefaultGuard();

    this.app.bind(PADLOCK_BINDINGS.service, (container) => {
      const twoFactorStore =
        this.options.twoFactorStoreToken && container.bound(this.options.twoFactorStoreToken)
          ? container.make<IPadlockTwoFactorStore>(this.options.twoFactorStoreToken)
          : undefined;
      const lockoutStore =
        this.options.lockoutStoreToken && container.bound(this.options.lockoutStoreToken)
          ? container.make<IPadlockLockoutStore>(this.options.lockoutStoreToken)
          : undefined;

      return new PadlockService<TUser>({
        guard: container.make<IAuthGuard>(this.tokens.guard),
        hasher: container.make<IHashManager>(this.tokens.hasher),
        userRepository: requireBound<IPadlockUserRepository<TUser>>(
          container,
          this.tokens.userRepository,
          "Padlock requires a user repository binding that implements the Padlock repository contract.",
        ),
        tokenStore: container.make<IPadlockTokenStore>(this.tokens.tokenStore),
        notifier: container.make<IPadlockNotifier<TUser>>(this.tokens.notifier),
        twoFactorStore,
        lockoutStore,
        config: this.options.serviceConfig,
      });
    });

    this.app.bind(
      PADLOCK_BINDINGS.controller,
      (container) =>
        new PadlockController<TUser>(
          container.make<PadlockService<TUser>>(PADLOCK_BINDINGS.service),
          this.options.controllerOptions,
        ),
    );

    this.app.alias(PADLOCK_BINDINGS.service, "padlock");
  }

  /**
   * Register Padlock routes when a router binding is available and route registration is enabled.
   */
  boot(): void {
    if (this.options.routeOptions === false || !this.app.bound("router")) {
      return;
    }

    registerPadlockRoutes(
      this.app.make<Router>("router"),
      () => this.app.make<PadlockController<TUser>>(PADLOCK_BINDINGS.controller),
      this.options.routeOptions,
    );
  }

  private registerDefaultHasher(): void {
    if (
      this.tokens.hasher === PADLOCK_BINDINGS.hasher &&
      !this.app.bound(PADLOCK_BINDINGS.hasher)
    ) {
      this.app.singleton(PADLOCK_BINDINGS.hasher, () => new HashManager());
    }
  }

  private registerDefaultTokenStore(): void {
    if (
      this.tokens.tokenStore === PADLOCK_BINDINGS.tokenStore &&
      !this.app.bound(PADLOCK_BINDINGS.tokenStore)
    ) {
      this.app.singleton(PADLOCK_BINDINGS.tokenStore, () => new MemoryPadlockTokenStore());
    }
  }

  private registerDefaultNotifier(): void {
    if (
      this.tokens.notifier === PADLOCK_BINDINGS.notifier &&
      !this.app.bound(PADLOCK_BINDINGS.notifier)
    ) {
      this.app.singleton(PADLOCK_BINDINGS.notifier, () => new NullPadlockNotifier<TUser>());
    }
  }

  private registerDefaultGuard(): void {
    if (this.tokens.guard !== PADLOCK_BINDINGS.guard || this.app.bound(PADLOCK_BINDINGS.guard)) {
      return;
    }

    this.app.bind(PADLOCK_BINDINGS.guard, (container) => {
      const repository = requireBound<IPadlockUserRepository<TUser>>(
        container,
        this.tokens.userRepository,
        "Padlock cannot create the default guard until a Padlock user repository binding exists.",
      );

      if (!isUserProvider(repository)) {
        throw new Error(
          "Padlock default guard creation requires a repository that also implements IUserProvider. " +
            "Bind a concrete auth guard such as SessionGuard or JwtGuard when your repository only implements Padlock workflows.",
        );
      }

      return new MemoryGuard(repository, container.make<IHashManager>(this.tokens.hasher));
    });
  }
}

function selectFirstBoundToken<T>(app: IContainer, tokens: Token<T>[]): Token<T> | null {
  for (const token of tokens) {
    if (app.bound(token)) {
      return token;
    }
  }

  return null;
}

function requireBound<T>(app: IContainerResolver, token: Token<T>, message: string): T {
  if (!app.bound(token)) {
    throw new Error(message);
  }

  return app.make<T>(token);
}

function isUserProvider<TUser extends IAuthenticatable>(
  repository: IPadlockUserRepository<TUser>,
): repository is IPadlockUserRepository<TUser> & IUserProvider {
  const candidate = repository as unknown as IUserProvider;
  return (
    typeof candidate.findById === "function" &&
    typeof candidate.findByCredentials === "function" &&
    typeof candidate.validateCredentials === "function"
  );
}
