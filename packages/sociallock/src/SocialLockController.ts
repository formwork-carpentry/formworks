/**
 * @module @formwork/sociallock/SocialLockController
 * @description HTTP controller for OAuth social login.
 */

import type { IAuthenticatable } from "@formwork/core/contracts";
import type { IRequest } from "@formwork/core/contracts";
import { CarpenterResponse } from "@formwork/http";
import { SocialLockError } from "./errors.js";
import type { SocialLockService } from "./SocialLockService.js";

export interface SocialLockControllerOptions {
  successRedirect?: string;
  errorRedirect?: string;
  serializeUser?: (user: IAuthenticatable) => Record<string, unknown>;
}

export class SocialLockController {
  constructor(
    private readonly service: SocialLockService,
    private readonly options: SocialLockControllerOptions = {},
  ) {}

  async redirect(request: IRequest) {
    const provider = request.param("provider");
    if (!provider) {
      return this.errorResponse("Missing provider.");
    }

    try {
      const { redirectUrl } = await this.service.redirect(provider);
      return CarpenterResponse.redirect(redirectUrl, 302);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async callback(request: IRequest) {
    const provider = request.param("provider");
    const code = request.query("code");
    const state = request.query("state");

    if (!provider) {
      return this.errorResponse("Missing provider.");
    }
    if (!code) {
      return this.errorResponse("Missing authorization code.");
    }
    if (!state) {
      return this.errorResponse("Missing state parameter.");
    }

    try {
      const result = await this.service.callback(provider, code, state);
      const successUrl = this.options.successRedirect ?? "/";
      const redirect = CarpenterResponse.redirect(successUrl, 302);

      if (result.token) {
        redirect.header("X-Auth-Token", result.token);
      }

      return redirect;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async callbackJson(request: IRequest) {
    const provider = request.param("provider");
    const code = request.query("code");
    const state = request.query("state");

    if (!provider) {
      return CarpenterResponse.json({ error: "Missing provider." }, 400);
    }
    if (!code) {
      return CarpenterResponse.json({ error: "Missing authorization code." }, 400);
    }
    if (!state) {
      return CarpenterResponse.json({ error: "Missing state parameter." }, 400);
    }

    try {
      const result = await this.service.callback(provider, code, state);
      return CarpenterResponse.json({
        data: this.serializeUser(result.user),
        token: result.token,
        is_new_user: result.isNewUser,
      });
    } catch (error) {
      return this.handleErrorJson(error);
    }
  }

  private errorResponse(message: string) {
    const base = this.options.errorRedirect ?? "/login";
    const url = `${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`;
    return CarpenterResponse.redirect(url, 302);
  }

  private handleError(error: unknown) {
    const base = this.options.errorRedirect ?? "/login";
    const message =
      error instanceof SocialLockError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Authentication failed";
    const url = `${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`;
    return CarpenterResponse.redirect(url, 302);
  }

  private handleErrorJson(error: unknown) {
    if (error instanceof SocialLockError) {
      return CarpenterResponse.json(
        { error: error.message, code: error.code },
        error.statusCode,
      );
    }

    return CarpenterResponse.json(
      { error: error instanceof Error ? error.message : "Authentication failed." },
      500,
    );
  }

  private serializeUser(user: IAuthenticatable): Record<string, unknown> {
    if (this.options.serializeUser) {
      return this.options.serializeUser(user);
    }

    const plain = user as unknown as Record<string, unknown>;
    const safe: Record<string, unknown> = {
      ...plain,
      id: plain["id"] ?? user.getAuthIdentifier(),
    };

    delete safe["password"];
    delete safe["passwordHash"];

    return safe;
  }
}
