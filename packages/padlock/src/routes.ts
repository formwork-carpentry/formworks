/**
 * @module @carpentry/padlock/routes
 * @description Default Padlock route registration with optional built-in auth throttling.
 * @patterns Facade, Strategy
 * @principles SRP - route registration and throttling stay separate from workflow orchestration and request validation.
 */

import type { IAuthenticatable, IRequest } from "@carpentry/core/contracts";
import type { Token } from "@carpentry/core/types";
import { CarpenterResponse, RateLimitMiddleware, type Request, type Router } from "@carpentry/http";
import type { RateLimitOptions } from "@carpentry/http";
import type { PadlockController } from "./PadlockController.js";

/**
 * Built-in throttle map for Padlock auth routes.
 */
export interface PadlockRouteThrottles {
  register?: RateLimitOptions | false;
  login?: RateLimitOptions | false;
  confirmTwoFactorLogin?: RateLimitOptions | false;
  forgotPassword?: RateLimitOptions | false;
  resetPassword?: RateLimitOptions | false;
  resendVerification?: RateLimitOptions | false;
  verifyEmail?: RateLimitOptions | false;
  changePassword?: RateLimitOptions | false;
  enableTwoFactor?: RateLimitOptions | false;
  confirmTwoFactor?: RateLimitOptions | false;
  disableTwoFactor?: RateLimitOptions | false;
}

/**
 * Route registration options for Padlock.
 */
export interface PadlockRouteOptions {
  prefix?: string;
  middleware?: Array<Token | string>;
  throttles?: PadlockRouteThrottles | false;
}

const DEFAULT_THROTTLES: Required<PadlockRouteThrottles> = {
  register: { maxRequests: 5, windowSeconds: 60 },
  login: { maxRequests: 5, windowSeconds: 60 },
  confirmTwoFactorLogin: { maxRequests: 5, windowSeconds: 60 },
  forgotPassword: { maxRequests: 3, windowSeconds: 300 },
  resetPassword: { maxRequests: 5, windowSeconds: 300 },
  resendVerification: { maxRequests: 3, windowSeconds: 300 },
  verifyEmail: { maxRequests: 10, windowSeconds: 300 },
  changePassword: { maxRequests: 5, windowSeconds: 60 },
  enableTwoFactor: { maxRequests: 3, windowSeconds: 60 },
  confirmTwoFactor: { maxRequests: 5, windowSeconds: 60 },
  disableTwoFactor: { maxRequests: 3, windowSeconds: 60 },
};

type PadlockRouteHandler = (request: IRequest) => Promise<CarpenterResponse>;
type PadlockControllerSource<TUser extends IAuthenticatable> =
  | PadlockController<TUser>
  | (() => PadlockController<TUser>);

/**
 * Register the default Padlock auth routes on a Carpenter router.
 *
 * @param router - Router to extend.
 * @param controller - Padlock HTTP controller.
 * @param options - Optional route prefix, middleware, and throttling controls.
 */
export function registerPadlockRoutes<TUser extends IAuthenticatable = IAuthenticatable>(
  router: Router,
  controller: PadlockControllerSource<TUser>,
  options: PadlockRouteOptions = {},
): void {
  const prefix = trimTrailingSlash(options.prefix ?? "/auth");
  const middleware = options.middleware ?? [];
  const throttles = resolveThrottles(options.throttles);

  router
    .post(
      `${prefix}/register`,
      throttle(
        handle(controller, (resolved, request) => resolved.register(request)),
        throttles.register,
      ),
    )
    .name("padlock.register")
    .middleware(...middleware);

  router
    .post(
      `${prefix}/login`,
      throttle(
        handle(controller, (resolved, request) => resolved.login(request)),
        throttles.login,
      ),
    )
    .name("padlock.login")
    .middleware(...middleware);

  router
    .post(
      `${prefix}/two-factor-challenge`,
      throttle(
        handle(controller, (resolved, request) => resolved.confirmTwoFactorLogin(request)),
        throttles.confirmTwoFactorLogin,
      ),
    )
    .name("padlock.confirm-two-factor-login")
    .middleware(...middleware);

  router
    .post(`${prefix}/logout`, () => resolveController(controller).logout())
    .name("padlock.logout")
    .middleware(...middleware);
  router
    .get(`${prefix}/me`, () => resolveController(controller).me())
    .name("padlock.me")
    .middleware(...middleware);

  router
    .post(
      `${prefix}/confirm-password`,
      throttle(
        handle(controller, (resolved, request) => resolved.confirmPassword(request)),
        false,
      ),
    )
    .name("padlock.confirm-password")
    .middleware(...middleware);

  router
    .post(
      `${prefix}/password`,
      throttle(
        handle(controller, (resolved, request) => resolved.changePassword(request)),
        throttles.changePassword,
      ),
    )
    .name("padlock.change-password")
    .middleware(...middleware);

  router
    .post(
      `${prefix}/two-factor-authentication`,
      throttle(
        handle(controller, (resolved, request) => resolved.enableTwoFactor(request)),
        throttles.enableTwoFactor,
      ),
    )
    .name("padlock.enable-two-factor")
    .middleware(...middleware);

  router
    .post(
      `${prefix}/two-factor-confirmation`,
      throttle(
        handle(controller, (resolved, request) => resolved.confirmTwoFactor(request)),
        throttles.confirmTwoFactor,
      ),
    )
    .name("padlock.confirm-two-factor")
    .middleware(...middleware);

  router
    .delete(
      `${prefix}/two-factor-authentication`,
      throttle(
        handle(controller, (resolved, request) => resolved.disableTwoFactor(request)),
        throttles.disableTwoFactor,
      ),
    )
    .name("padlock.disable-two-factor")
    .middleware(...middleware);

  router
    .post(
      `${prefix}/forgot-password`,
      throttle(
        handle(controller, (resolved, request) => resolved.forgotPassword(request)),
        throttles.forgotPassword,
      ),
    )
    .name("padlock.forgot-password")
    .middleware(...middleware);

  router
    .post(
      `${prefix}/reset-password`,
      throttle(
        handle(controller, (resolved, request) => resolved.resetPassword(request)),
        throttles.resetPassword,
      ),
    )
    .name("padlock.reset-password")
    .middleware(...middleware);

  router
    .post(
      `${prefix}/email/verification-notification`,
      throttle(
        handle(controller, (resolved, request) => resolved.resendVerification(request)),
        throttles.resendVerification,
      ),
    )
    .name("padlock.verification-notification")
    .middleware(...middleware);

  router
    .get(
      `${prefix}/verify-email/:token`,
      throttle(
        handle(controller, (resolved, request) => resolved.verifyEmail(request)),
        throttles.verifyEmail,
      ),
    )
    .name("padlock.verify-email")
    .middleware(...middleware);
}

function resolveThrottles(overrides: PadlockRouteOptions["throttles"]): PadlockRouteThrottles {
  if (overrides === false) {
    return {
      register: false,
      login: false,
      confirmTwoFactorLogin: false,
      forgotPassword: false,
      resetPassword: false,
      resendVerification: false,
      verifyEmail: false,
      changePassword: false,
      enableTwoFactor: false,
      confirmTwoFactor: false,
      disableTwoFactor: false,
    };
  }

  return {
    register: overrides?.register ?? DEFAULT_THROTTLES.register,
    login: overrides?.login ?? DEFAULT_THROTTLES.login,
    confirmTwoFactorLogin:
      overrides?.confirmTwoFactorLogin ?? DEFAULT_THROTTLES.confirmTwoFactorLogin,
    forgotPassword: overrides?.forgotPassword ?? DEFAULT_THROTTLES.forgotPassword,
    resetPassword: overrides?.resetPassword ?? DEFAULT_THROTTLES.resetPassword,
    resendVerification: overrides?.resendVerification ?? DEFAULT_THROTTLES.resendVerification,
    verifyEmail: overrides?.verifyEmail ?? DEFAULT_THROTTLES.verifyEmail,
    changePassword: overrides?.changePassword ?? DEFAULT_THROTTLES.changePassword,
    enableTwoFactor: overrides?.enableTwoFactor ?? DEFAULT_THROTTLES.enableTwoFactor,
    confirmTwoFactor: overrides?.confirmTwoFactor ?? DEFAULT_THROTTLES.confirmTwoFactor,
    disableTwoFactor: overrides?.disableTwoFactor ?? DEFAULT_THROTTLES.disableTwoFactor,
  };
}

function throttle(
  handler: PadlockRouteHandler,
  options: RateLimitOptions | false | undefined,
): PadlockRouteHandler {
  if (options === false || options === undefined) {
    return handler;
  }

  const limiter = new RateLimitMiddleware({
    ...options,
    onLimitExceeded:
      options.onLimitExceeded ??
      ((_request, retryAfterSeconds) => {
        const response = CarpenterResponse.json(
          {
            error: "Too many authentication attempts.",
            retry_after: retryAfterSeconds,
          },
          429,
        );
        response.header("Retry-After", String(retryAfterSeconds));
        return response;
      }),
  });

  return async (request: IRequest) => limiter.handle(request as Request, () => handler(request));
}

function handle<TUser extends IAuthenticatable>(
  controller: PadlockControllerSource<TUser>,
  callback: (resolved: PadlockController<TUser>, request: IRequest) => Promise<CarpenterResponse>,
): PadlockRouteHandler {
  return async (request: IRequest) => callback(resolveController(controller), request);
}

function resolveController<TUser extends IAuthenticatable>(
  controller: PadlockControllerSource<TUser>,
): PadlockController<TUser> {
  return typeof controller === "function" ? controller() : controller;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") && value !== "/" ? value.slice(0, -1) : value;
}
