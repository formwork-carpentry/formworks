/**
 * @module @carpentry/sociallock/SocialLockServiceProvider
 * @description Service provider for SocialLock OAuth workflows.
 */

import type { IAuthGuard, IAuthenticatable } from "@carpentry/core/contracts";
import { type IContainer, ServiceProvider } from "@carpentry/core/container";
import type { Token } from "@carpentry/core/types";
import type { Router } from "@carpentry/http";
import { SOCIALLOCK_BINDINGS } from "./bindings.js";
import type { IStateStore, ISocialUserRepository, OAuthProviderConfig } from "./contracts.js";
import { SocialLockController, type SocialLockControllerOptions } from "./SocialLockController.js";
import { SocialLockService } from "./SocialLockService.js";
import { registerSocialLockRoutes, type SocialLockRouteOptions } from "./routes.js";
import { MemoryStateStore } from "./state/MemoryStateStore.js";

export interface SocialLockServiceProviderOptions<
  TUser extends IAuthenticatable = IAuthenticatable,
> {
  stateStoreToken?: Token<IStateStore>;
  guardToken?: Token<IAuthGuard>;
  userRepositoryToken?: Token<ISocialUserRepository<TUser>>;
  providers?: Map<string, OAuthProviderConfig>;
  controllerOptions?: SocialLockControllerOptions;
  routeOptions?: SocialLockRouteOptions | false;
}

export class SocialLockServiceProvider<
  TUser extends IAuthenticatable = IAuthenticatable,
> extends ServiceProvider {
  constructor(
    app: IContainer,
    private readonly options: SocialLockServiceProviderOptions<TUser> = {},
  ) {
    super(app);
  }

  register(): void {
    const stateStore =
      this.options.stateStoreToken && this.app.bound(this.options.stateStoreToken)
        ? this.app.make<IStateStore>(this.options.stateStoreToken)
        : new MemoryStateStore();

    if (!this.app.bound(SOCIALLOCK_BINDINGS.stateStore)) {
      this.app.instance(SOCIALLOCK_BINDINGS.stateStore, stateStore);
    }

    const providers = this.options.providers ?? new Map<string, OAuthProviderConfig>();
    if (!this.app.bound(SOCIALLOCK_BINDINGS.providers)) {
      this.app.instance(SOCIALLOCK_BINDINGS.providers, providers);
    }

    const guardToken = this.options.guardToken ?? "auth";
    const userRepositoryToken =
      this.options.userRepositoryToken ?? SOCIALLOCK_BINDINGS.userRepository;

    if (!this.app.bound(userRepositoryToken)) {
      throw new Error(
        "SocialLock requires a user repository binding. Pass userRepositoryToken or bind \"sociallock.user-repository\".",
      );
    }

    this.app.bind(SOCIALLOCK_BINDINGS.service, (container) => {
      const userRepository = container.make<ISocialUserRepository<TUser>>(userRepositoryToken);

      return new SocialLockService<TUser>({
        guard: container.make<IAuthGuard>(guardToken),
        userRepository,
        stateStore: container.make<IStateStore>(SOCIALLOCK_BINDINGS.stateStore),
        providers: container.make<Map<string, OAuthProviderConfig>>(SOCIALLOCK_BINDINGS.providers),
      });
    });

    this.app.bind(
      SOCIALLOCK_BINDINGS.controller,
      (container) =>
        new SocialLockController(
          container.make<SocialLockService<TUser>>(SOCIALLOCK_BINDINGS.service),
          this.options.controllerOptions,
        ),
    );

    this.app.alias(SOCIALLOCK_BINDINGS.service, "sociallock");
  }

  boot(): void {
    if (this.options.routeOptions === false || !this.app.bound("router")) {
      return;
    }

    registerSocialLockRoutes(
      this.app.make<Router>("router"),
      () => this.app.make<SocialLockController>(SOCIALLOCK_BINDINGS.controller),
      this.options.routeOptions ?? {},
    );
  }
}
