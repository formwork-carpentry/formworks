/**
 * @module @carpentry/sociallock/routes
 * @description OAuth route registration.
 */

import type { Token } from "@carpentry/core/types";
import type { Router } from "@carpentry/http";
import type { SocialLockController } from "./SocialLockController.js";

export interface SocialLockRouteOptions {
  prefix?: string;
  middleware?: Array<Token | string>;
  jsonCallback?: boolean;
}

type SocialLockControllerSource = SocialLockController | (() => SocialLockController);

export function registerSocialLockRoutes(
  router: Router,
  controller: SocialLockControllerSource,
  options: SocialLockRouteOptions = {},
): void {
  const prefix = (options.prefix ?? "/auth").replace(/\/$/, "") || "/auth";
  const middleware = options.middleware ?? [];
  const resolve = () => (typeof controller === "function" ? controller() : controller);

  router
    .get(`${prefix}/:provider`, (request) => resolve().redirect(request))
    .name("sociallock.redirect")
    .middleware(...middleware);

  if (options.jsonCallback) {
    router
      .get(`${prefix}/:provider/callback`, (request) => resolve().callbackJson(request))
      .name("sociallock.callback.json")
      .middleware(...middleware);
    return;
  }

  router
    .get(`${prefix}/:provider/callback`, (request) => resolve().callback(request))
    .name("sociallock.callback")
    .middleware(...middleware);
}
