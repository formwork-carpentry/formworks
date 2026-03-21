/**
 * @module @formwork/padlock/PadlockController
 * @description HTTP controller that validates requests and maps them onto Padlock workflow operations.
 * @patterns Facade, Adapter
 * @principles SRP - request validation and response mapping stay here while PadlockService owns auth workflows.
 */

import type { IAuthenticatable, IRequest, ValidationRules } from "@formwork/core/contracts";
import { CarpenterResponse } from "@formwork/http";
import { Validator } from "@formwork/validation";
import type { PadlockService } from "./PadlockService.js";
import type { PadlockDispatchResult } from "./contracts.js";
import { PadlockError } from "./errors.js";

/**
 * Optional HTTP adapter configuration for Padlock.
 */
export interface PadlockControllerOptions<TUser extends IAuthenticatable = IAuthenticatable> {
  serializeUser?: (user: TUser) => unknown;
  registerRules?: ValidationRules;
  loginRules?: ValidationRules;
  forgotPasswordRules?: ValidationRules;
  resetPasswordRules?: ValidationRules;
  confirmTwoFactorLoginRules?: ValidationRules;
  changePasswordRules?: ValidationRules;
  confirmPasswordRules?: ValidationRules;
}

const DEFAULT_REGISTER_RULES: ValidationRules = {
  name: "required|string|min:2",
  email: "required|email",
  password: "required|string|min:8",
};

const DEFAULT_LOGIN_RULES: ValidationRules = {
  email: "required|email",
  password: "required|string",
};

const DEFAULT_FORGOT_PASSWORD_RULES: ValidationRules = {
  email: "required|email",
};

const DEFAULT_RESET_PASSWORD_RULES: ValidationRules = {
  token: "required|string",
  password: "required|string|min:8",
};

const DEFAULT_CONFIRM_TWO_FACTOR_RULES: ValidationRules = {
  challenge_token: "required|string",
  code: "required|string",
};

const DEFAULT_CHANGE_PASSWORD_RULES: ValidationRules = {
  current_password: "required|string",
  new_password: "required|string|min:8",
};

const DEFAULT_CONFIRM_PASSWORD_RULES: ValidationRules = {
  password: "required|string",
};

/**
 * Controller that maps HTTP requests onto Padlock workflow actions.
 */
export class PadlockController<TUser extends IAuthenticatable = IAuthenticatable> {
  private readonly validator: Validator;

  constructor(
    private readonly service: PadlockService<TUser>,
    private readonly options: PadlockControllerOptions<TUser> = {},
  ) {
    this.validator = new Validator();
  }

  /**
   * Register a new user account.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async register(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(request, this.options.registerRules ?? DEFAULT_REGISTER_RULES);
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    try {
      const result = await this.service.register(
        validated as Record<string, unknown> & { email: string; password: string },
      );
      return CarpenterResponse.json(
        {
          data: this.serializeUser(result.user),
          token: result.token,
        },
        201,
      );
    } catch (error) {
      return this.renderError(error);
    }
  }

  /**
   * Authenticate a user. When 2FA is enabled, returns a challenge token.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async login(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(request, this.options.loginRules ?? DEFAULT_LOGIN_RULES);
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    try {
      const result = await this.service.login(validated as { email: string; password: string });
      if ("needsTwoFactor" in result && result.needsTwoFactor) {
        return CarpenterResponse.json({
          needs_two_factor: true,
          challenge_token: result.challengeToken,
          expires_in_seconds: result.expiresInSeconds,
        });
      }
      if ("user" in result && "token" in result) {
        return CarpenterResponse.json({
          data: this.serializeUser(result.user),
          token: result.token,
        });
      }
      return this.renderError(new Error("Unexpected login result"));
    } catch (error) {
      return this.renderError(error);
    }
  }

  /**
   * Complete login after 2FA challenge.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async confirmTwoFactorLogin(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(
      request,
      this.options.confirmTwoFactorLoginRules ?? DEFAULT_CONFIRM_TWO_FACTOR_RULES,
    );
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    try {
      const result = await this.service.confirmTwoFactorLogin(
        String(validated.challenge_token),
        String(validated.code),
      );
      return CarpenterResponse.json({
        data: this.serializeUser(result.user),
        token: result.token,
      });
    } catch (error) {
      return this.renderError(error);
    }
  }

  /**
   * Confirm the current user's password (for sensitive actions).
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async confirmPassword(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(
      request,
      this.options.confirmPasswordRules ?? DEFAULT_CONFIRM_PASSWORD_RULES,
    );
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    try {
      const valid = await this.service.confirmPassword(String(validated.password));
      return CarpenterResponse.json({ confirmed: valid });
    } catch (error) {
      return this.renderError(error);
    }
  }

  /**
   * Change the authenticated user's password.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async changePassword(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(
      request,
      this.options.changePasswordRules ?? DEFAULT_CHANGE_PASSWORD_RULES,
    );
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    try {
      const user = await this.service.changePassword({
        currentPassword: String(validated.current_password),
        newPassword: String(validated.new_password),
      });
      return CarpenterResponse.json({
        data: this.serializeUser(user),
        message: "Password changed successfully.",
      });
    } catch (error) {
      return this.renderError(error);
    }
  }

  /**
   * Start 2FA setup. Returns QR URL for authenticator app.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async enableTwoFactor(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(request, DEFAULT_CONFIRM_PASSWORD_RULES);
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    try {
      const result = await this.service.enableTwoFactor(String(validated.password));
      return CarpenterResponse.json({
        secret: result.secret,
        qr_code_url: result.qrCodeUrl,
      });
    } catch (error) {
      return this.renderError(error);
    }
  }

  /**
   * Confirm 2FA setup with a TOTP code.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async confirmTwoFactor(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(request, { code: "required|string" });
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    try {
      const result = await this.service.confirmTwoFactor(String(validated.code));
      return CarpenterResponse.json({
        recovery_codes: result.recoveryCodes,
        message: "Two-factor authentication has been enabled.",
      });
    } catch (error) {
      return this.renderError(error);
    }
  }

  /**
   * Disable 2FA.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async disableTwoFactor(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(request, DEFAULT_CONFIRM_PASSWORD_RULES);
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    try {
      await this.service.disableTwoFactor(String(validated.password));
      return CarpenterResponse.json({ message: "Two-factor authentication has been disabled." });
    } catch (error) {
      return this.renderError(error);
    }
  }

  /**
   * Log out the current user.
   *
   * @returns HTTP response.
   */
  async logout(): Promise<CarpenterResponse> {
    await this.service.logout();
    return CarpenterResponse.json({ ok: true });
  }

  /**
   * Return the current authenticated user.
   *
   * @returns HTTP response.
   */
  async me(): Promise<CarpenterResponse> {
    const user = await this.service.me();
    if (!user) {
      return CarpenterResponse.json({ error: "Unauthenticated." }, 401);
    }

    return CarpenterResponse.json({ data: this.serializeUser(user) });
  }

  /**
   * Send a password-reset token when the email exists.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async forgotPassword(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(
      request,
      this.options.forgotPasswordRules ?? DEFAULT_FORGOT_PASSWORD_RULES,
    );
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    const result = await this.service.requestPasswordReset(String(validated.email));
    return this.renderDispatchResult(
      result,
      "If the account exists, a password reset link has been sent.",
    );
  }

  /**
   * Reset a user's password using a valid token.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async resetPassword(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(
      request,
      this.options.resetPasswordRules ?? DEFAULT_RESET_PASSWORD_RULES,
    );
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    try {
      const user = await this.service.resetPassword({
        token: String(validated.token),
        password: String(validated.password),
      });
      return CarpenterResponse.json({
        data: this.serializeUser(user),
        message: "Password reset complete.",
      });
    } catch (error) {
      return this.renderError(error);
    }
  }

  /**
   * Resend an email-verification token.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async resendVerification(request: IRequest): Promise<CarpenterResponse> {
    const validated = this.validate(
      request,
      this.options.forgotPasswordRules ?? DEFAULT_FORGOT_PASSWORD_RULES,
    );
    if (validated instanceof CarpenterResponse) {
      return validated;
    }

    const result = await this.service.resendEmailVerification(String(validated.email));
    return this.renderDispatchResult(
      result,
      "If the account requires verification, a verification link has been sent.",
    );
  }

  /**
   * Verify an email token from a route parameter.
   *
   * @param request - Incoming HTTP request.
   * @returns HTTP response.
   */
  async verifyEmail(request: IRequest): Promise<CarpenterResponse> {
    try {
      const token = request.param("token");
      if (!token) {
        return CarpenterResponse.json({ error: "Missing verification token." }, 422);
      }

      const user = await this.service.verifyEmail(token);
      return CarpenterResponse.json({
        data: this.serializeUser(user),
        message: "Email verified.",
      });
    } catch (error) {
      return this.renderError(error);
    }
  }

  private validate(
    request: IRequest,
    rules: ValidationRules,
  ): Record<string, unknown> | CarpenterResponse {
    const payload = request.body<Record<string, unknown>>() ?? {};
    const result = this.validator.validate(payload, rules);
    if (!result.passes) {
      return CarpenterResponse.json({ errors: result.errors }, 422);
    }

    return result.validated;
  }

  private renderDispatchResult(result: PadlockDispatchResult, message: string): CarpenterResponse {
    return CarpenterResponse.json({ ok: true, dispatched: result.dispatched, message });
  }

  private renderError(error: unknown): CarpenterResponse {
    if (error instanceof PadlockError) {
      return CarpenterResponse.json({ error: error.message, code: error.code }, error.statusCode);
    }

    return CarpenterResponse.json(
      { error: (error as Error).message ?? "Unexpected Padlock error." },
      500,
    );
  }

  private serializeUser(user: TUser): unknown {
    if (this.options.serializeUser) {
      return this.options.serializeUser(user);
    }

    const candidate = user as TUser & { toJSON?: () => unknown };
    if (typeof candidate.toJSON === "function") {
      return candidate.toJSON();
    }

    const plain = user as Record<string, unknown>;
    const safe: Record<string, unknown> = { ...plain, id: plain.id ?? user.getAuthIdentifier() };
    safe.password = undefined;
    safe.passwordHash = undefined;
    safe.password_hash = undefined;
    return safe;
  }
}
