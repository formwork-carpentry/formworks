/**
 * @module @formwork/padlock/PadlockService
 * @description Fortify-style workflow orchestration built on Carpenter auth primitives.
 * @patterns Facade, Strategy
 * @principles SRP - coordinates auth workflows while repositories, token stores, and notifiers own persistence and delivery concerns.
 */

import { randomBytes } from "node:crypto";
import type { IAuthGuard, IAuthenticatable, IHashManager } from "@formwork/core/contracts";
import type {
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
  PadlockRegistrationInput,
  PadlockTokenPurpose,
  PadlockTwoFactorChallengeResult,
  PadlockTwoFactorSetupResult,
} from "./contracts.js";
import { PadlockError } from "./errors.js";
import { MemoryLockoutStore } from "./lockout/MemoryLockoutStore.js";
import { NullLockoutStore } from "./lockout/NullLockoutStore.js";
import { BuiltInTotpProvider } from "./totp/BuiltInTotpProvider.js";

interface TokenAwareGuard {
  getToken(): string | null;
}

/**
 * Dependencies required by the Padlock workflow service.
 */
export interface PadlockServiceDependencies<TUser extends IAuthenticatable = IAuthenticatable> {
  guard: IAuthGuard;
  hasher: IHashManager;
  userRepository: IPadlockUserRepository<TUser>;
  tokenStore: IPadlockTokenStore;
  notifier: IPadlockNotifier<TUser>;
  config?: PadlockConfig;
  /** Optional. When provided, enables 2FA flows. */
  twoFactorStore?: IPadlockTwoFactorStore;
  /** Optional. When provided, enables account lockout. */
  lockoutStore?: IPadlockLockoutStore;
  /** Optional. Defaults to BuiltInTotpProvider when 2FA is enabled. */
  totpProvider?: ITotpProvider;
}

const DEFAULT_CONFIG: Required<PadlockConfig> = {
  autoLoginOnRegistration: true,
  sendEmailVerificationOnRegistration: true,
  emailVerificationTtlSeconds: 60 * 60 * 24,
  passwordResetTtlSeconds: 60 * 30,
  lockoutMaxAttempts: 5,
  lockoutMinutes: 1,
  passwordConfirmationTtlSeconds: 300,
  twoFactorRecoveryCodesCount: 8,
  twoFactorIssuer: "Padlock",
  twoFactorChallengeTtlSeconds: 300,
};

/**
 * High-level authentication workflow service for registration, login, and token-based flows.
 */
export class PadlockService<TUser extends IAuthenticatable = IAuthenticatable> {
  private readonly config: Required<PadlockConfig>;
  private readonly lockoutStore: IPadlockLockoutStore;
  private readonly totpProvider: ITotpProvider | null;

  constructor(private readonly dependencies: PadlockServiceDependencies<TUser>) {
    this.config = { ...DEFAULT_CONFIG, ...dependencies.config };
    this.lockoutStore =
      dependencies.lockoutStore ??
      (this.config.lockoutMaxAttempts > 0
        ? new MemoryLockoutStore(this.config.lockoutMaxAttempts, this.config.lockoutMinutes)
        : new NullLockoutStore());
    this.totpProvider = dependencies.twoFactorStore
      ? (dependencies.totpProvider ?? new BuiltInTotpProvider())
      : null;
  }

  /**
   * Register a new user and optionally sign them in.
   *
   * @param input - Registration payload.
   * @returns Auth result containing the created user and any guard-issued token.
   */
  async register(input: PadlockRegistrationInput): Promise<PadlockAuthResult<TUser>> {
    const existing = await this.dependencies.userRepository.findByEmail(input.email);
    if (existing) {
      throw new PadlockError(
        "duplicate-email",
        409,
        `A user with email "${input.email}" already exists.`,
      );
    }

    const { password, ...attributes } = input;
    const passwordHash = await this.dependencies.hasher.make(password);
    const user = await this.dependencies.userRepository.create({
      ...attributes,
      email: input.email,
      passwordHash,
      emailVerifiedAt: null,
    });

    if (
      this.config.autoLoginOnRegistration &&
      typeof this.dependencies.guard.login === "function"
    ) {
      await this.dependencies.guard.login(user);
    }

    if (this.config.sendEmailVerificationOnRegistration) {
      await this.dispatchToken("email-verification", user);
    }

    return { user, token: this.extractToken() };
  }

  /**
   * Authenticate a user through the configured guard.
   * When 2FA is enabled, returns a challenge result instead of logging in.
   *
   * @param credentials - Login credentials.
   * @returns Auth result, or two-factor challenge when 2FA is enabled.
   */
  async login(
    credentials: PadlockLoginInput,
  ): Promise<PadlockAuthResult<TUser> | PadlockTwoFactorChallengeResult> {
    const lockoutKey = `login:${credentials.email}`;

    if (this.config.lockoutMaxAttempts > 0) {
      const locked = await this.lockoutStore.isLocked(lockoutKey);
      if (locked) {
        const seconds = await this.lockoutStore.getLockoutSeconds(lockoutKey);
        throw new PadlockError(
          "account-locked",
          429,
          `Too many failed attempts. Try again in ${seconds} seconds.`,
        );
      }
    }

    const ok = await this.dependencies.guard.attempt({ ...credentials });
    if (!ok) {
      if (this.config.lockoutMaxAttempts > 0) {
        const attempts = await this.lockoutStore.recordFailedAttempt(lockoutKey);
        if (attempts >= this.config.lockoutMaxAttempts) {
          const seconds = this.config.lockoutMinutes * 60;
          throw new PadlockError(
            "account-locked",
            429,
            `Too many failed attempts. Try again in ${seconds} seconds.`,
          );
        }
      }
      throw new PadlockError("invalid-credentials", 401, "The provided credentials are invalid.");
    }

    const user = await this.resolveCurrentUser(credentials.email);
    if (!user) {
      throw new PadlockError("user-not-found", 404, "The authenticated user could not be loaded.");
    }

    if (this.config.lockoutMaxAttempts > 0) {
      await this.lockoutStore.clearAttempts(lockoutKey);
    }

    const twoFactorStore = this.dependencies.twoFactorStore;
    if (twoFactorStore && (await twoFactorStore.isEnabled(user.getAuthIdentifier()))) {
      await this.dependencies.guard.logout();
      const challengeToken = await this.issueTwoFactorChallenge(user);
      return {
        needsTwoFactor: true,
        challengeToken,
        expiresInSeconds: this.config.twoFactorChallengeTtlSeconds,
      };
    }

    return { user, token: this.extractToken() };
  }

  private async issueTwoFactorChallenge(user: TUser): Promise<string> {
    await this.dependencies.tokenStore.revokeForUser(
      "two-factor-challenge",
      user.getAuthIdentifier(),
    );
    const record = await this.dependencies.tokenStore.issue({
      purpose: "two-factor-challenge",
      userId: user.getAuthIdentifier(),
      ttlSeconds: this.config.twoFactorChallengeTtlSeconds,
    });
    return record.token;
  }

  /**
   * Confirm the current user's password. Used before sensitive actions (e.g. enable 2FA, disable 2FA, change password).
   *
   * @param password - Current password.
   * @returns True if the password is correct.
   */
  async confirmPassword(password: string): Promise<boolean> {
    const user = await this.me();
    if (!user) {
      throw new PadlockError(
        "unauthenticated",
        401,
        "You must be logged in to confirm your password.",
      );
    }

    return this.dependencies.hasher.check(password, user.getAuthPassword());
  }

  /**
   * Change the authenticated user's password.
   *
   * @param input - Current and new password.
   * @returns Updated user.
   */
  async changePassword(input: PadlockChangePasswordInput): Promise<TUser> {
    const user = await this.me();
    if (!user) {
      throw new PadlockError(
        "unauthenticated",
        401,
        "You must be logged in to change your password.",
      );
    }

    const valid = await this.dependencies.hasher.check(
      input.currentPassword,
      user.getAuthPassword(),
    );
    if (!valid) {
      throw new PadlockError("invalid-password", 422, "The current password is incorrect.");
    }

    const passwordHash = await this.dependencies.hasher.make(input.newPassword);
    const updated = await this.dependencies.userRepository.updatePassword(
      user.getAuthIdentifier(),
      passwordHash,
    );
    if (!updated) {
      throw new PadlockError("user-not-found", 404, "The user could not be updated.");
    }

    return updated;
  }

  /**
   * Start 2FA setup. Returns secret and QR URL for the user to scan.
   * Requires password confirmation first.
   *
   * @param password - Current password (for confirmation).
   * @returns Setup result with QR URL. Recovery codes are returned from confirmTwoFactor.
   */
  async enableTwoFactor(
    password: string,
  ): Promise<Omit<PadlockTwoFactorSetupResult, "recoveryCodes">> {
    const user = await this.me();
    if (!user) {
      throw new PadlockError("unauthenticated", 401, "You must be logged in to enable 2FA.");
    }

    const valid = await this.confirmPassword(password);
    if (!valid) {
      throw new PadlockError("invalid-password", 422, "The password is incorrect.");
    }

    const twoFactorStore = this.dependencies.twoFactorStore;
    if (!twoFactorStore || !this.totpProvider) {
      throw new PadlockError(
        "invalid-credentials",
        400,
        "Two-factor authentication is not configured.",
      );
    }

    const alreadyEnabled = await twoFactorStore.isEnabled(user.getAuthIdentifier());
    if (alreadyEnabled) {
      throw new PadlockError(
        "two-factor-already-enabled",
        422,
        "Two-factor authentication is already enabled.",
      );
    }

    const secret = this.totpProvider.generateSecret();
    await twoFactorStore.setPendingSecret(user.getAuthIdentifier(), secret);

    const accountName = (user as { email?: string }).email ?? String(user.getAuthIdentifier());
    const qrCodeUrl = this.totpProvider.otpauthUrl(
      secret,
      accountName,
      this.config.twoFactorIssuer,
    );

    return {
      secret,
      qrCodeUrl,
    };
  }

  /**
   * Confirm 2FA setup with a TOTP code from the authenticator app.
   * Stores the secret and recovery codes after verification.
   *
   * @param code - TOTP code from the authenticator app.
   * @returns Recovery codes to show the user once (they must store them).
   */
  async confirmTwoFactor(code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.me();
    if (!user) {
      throw new PadlockError("unauthenticated", 401, "You must be logged in to confirm 2FA.");
    }

    const twoFactorStore = this.dependencies.twoFactorStore;
    if (!twoFactorStore || !this.totpProvider) {
      throw new PadlockError(
        "invalid-credentials",
        400,
        "Two-factor authentication is not configured.",
      );
    }

    const pendingSecret = await twoFactorStore.getPendingSecret(user.getAuthIdentifier());
    if (!pendingSecret) {
      throw new PadlockError(
        "invalid-two-factor-code",
        422,
        "No pending 2FA setup. Please start the setup again.",
      );
    }

    const valid = await this.totpProvider.verify(pendingSecret, code);
    if (!valid) {
      throw new PadlockError("invalid-two-factor-code", 422, "The provided code is invalid.");
    }

    await twoFactorStore.confirmAndEnable(user.getAuthIdentifier());

    const recoveryCodes = this.generateRecoveryCodes();
    const hashedCodes = await Promise.all(
      recoveryCodes.map((c) => this.dependencies.hasher.make(c)),
    );
    await twoFactorStore.setRecoveryCodes(user.getAuthIdentifier(), hashedCodes);

    return { recoveryCodes };
  }

  /**
   * Disable 2FA. Requires password confirmation.
   *
   * @param password - Current password.
   */
  async disableTwoFactor(password: string): Promise<void> {
    const user = await this.me();
    if (!user) {
      throw new PadlockError("unauthenticated", 401, "You must be logged in to disable 2FA.");
    }

    const valid = await this.confirmPassword(password);
    if (!valid) {
      throw new PadlockError("invalid-password", 422, "The password is incorrect.");
    }

    const twoFactorStore = this.dependencies.twoFactorStore;
    if (!twoFactorStore) {
      throw new PadlockError(
        "invalid-credentials",
        400,
        "Two-factor authentication is not configured.",
      );
    }

    const enabled = await twoFactorStore.isEnabled(user.getAuthIdentifier());
    if (!enabled) {
      throw new PadlockError(
        "two-factor-not-enabled",
        422,
        "Two-factor authentication is not enabled.",
      );
    }

    await twoFactorStore.removeSecret(user.getAuthIdentifier());
  }

  private generateRecoveryCodes(): string[] {
    const count = this.config.twoFactorRecoveryCodesCount;
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(
        `${randomBytes(4).toString("hex")}-${randomBytes(4).toString("hex")}-${randomBytes(4).toString("hex")}`,
      );
    }
    return codes;
  }

  /**
   * Complete login after 2FA challenge. Verifies TOTP code or recovery code.
   *
   * @param challengeToken - Token from login() when needsTwoFactor.
   * @param code - TOTP code from authenticator app, or a recovery code.
   * @returns Auth result on success.
   */
  async confirmTwoFactorLogin(
    challengeToken: string,
    code: string,
  ): Promise<PadlockAuthResult<TUser>> {
    const record = await this.consumeToken("two-factor-challenge", challengeToken);
    const twoFactorStore = this.dependencies.twoFactorStore;
    if (!twoFactorStore) {
      throw new PadlockError(
        "invalid-credentials",
        400,
        "Two-factor authentication is not configured.",
      );
    }
    const user = await this.dependencies.userRepository.findById(record.userId);
    if (!user) {
      throw new PadlockError("user-not-found", 404, "The authenticated user could not be loaded.");
    }

    const secret = await twoFactorStore.getSecret(record.userId);
    if (!secret) {
      throw new PadlockError("invalid-token", 422, "The challenge token is invalid or expired.");
    }

    const isValidTotp = await this.totpProvider?.verify(secret, code);
    if (isValidTotp) {
      if (typeof this.dependencies.guard.login === "function") {
        await this.dependencies.guard.login(user);
      }
      return { user, token: this.extractToken() };
    }

    const isValidRecovery = await twoFactorStore.consumeRecoveryCode(
      record.userId,
      code,
      this.dependencies.hasher,
    );
    if (isValidRecovery) {
      if (typeof this.dependencies.guard.login === "function") {
        await this.dependencies.guard.login(user);
      }
      return { user, token: this.extractToken() };
    }

    throw new PadlockError("invalid-two-factor-code", 422, "The provided code is invalid.");
  }

  /**
   * Log out the currently authenticated user.
   */
  async logout(): Promise<void> {
    await this.dependencies.guard.logout();
  }

  /**
   * Resolve the currently authenticated user.
   *
   * @returns Authenticated user or `null`.
   */
  async me(): Promise<TUser | null> {
    if (typeof this.dependencies.guard.user === "function") {
      const user = await this.dependencies.guard.user<TUser>();
      if (user) {
        return user;
      }
    }

    const id = await this.dependencies.guard.id();
    return id === null ? null : this.dependencies.userRepository.findById(id);
  }

  /**
   * Send a password-reset token when a matching user exists.
   *
   * @param email - User email address.
   * @returns Dispatch result.
   */
  async requestPasswordReset(email: string): Promise<PadlockDispatchResult> {
    const user = await this.dependencies.userRepository.findByEmail(email);
    if (!user) {
      return { dispatched: false };
    }

    await this.dispatchToken("password-reset", user);
    return { dispatched: true };
  }

  /**
   * Consume a password-reset token and rotate the user's password hash.
   *
   * @param input - Reset password payload.
   * @returns Updated user.
   */
  async resetPassword(input: PadlockPasswordResetInput): Promise<TUser> {
    const record = await this.consumeToken("password-reset", input.token);
    const passwordHash = await this.dependencies.hasher.make(input.password);
    const user = await this.dependencies.userRepository.updatePassword(record.userId, passwordHash);
    if (!user) {
      throw new PadlockError(
        "user-not-found",
        404,
        "The password-reset target user no longer exists.",
      );
    }

    return user;
  }

  /**
   * Send a new email-verification token for a user email address.
   *
   * @param email - User email address.
   * @returns Dispatch result.
   */
  async resendEmailVerification(email: string): Promise<PadlockDispatchResult> {
    const user = await this.dependencies.userRepository.findByEmail(email);
    if (!user) {
      return { dispatched: false };
    }

    const alreadyVerified = await this.dependencies.userRepository.isEmailVerified(
      user.getAuthIdentifier(),
    );
    if (alreadyVerified) {
      return { dispatched: false };
    }

    await this.dispatchToken("email-verification", user);
    return { dispatched: true };
  }

  /**
   * Consume an email-verification token and mark the user as verified.
   *
   * @param token - Verification token.
   * @returns Updated verified user.
   */
  async verifyEmail(token: string): Promise<TUser> {
    const record = await this.consumeToken("email-verification", token);
    const user = await this.dependencies.userRepository.markEmailVerified(
      record.userId,
      new Date(),
    );
    if (!user) {
      throw new PadlockError(
        "user-not-found",
        404,
        "The email-verification target user no longer exists.",
      );
    }

    return user;
  }

  private async dispatchToken(purpose: PadlockTokenPurpose, user: TUser): Promise<void> {
    await this.dependencies.tokenStore.revokeForUser(purpose, user.getAuthIdentifier());

    const record = await this.dependencies.tokenStore.issue({
      purpose,
      userId: user.getAuthIdentifier(),
      ttlSeconds:
        purpose === "email-verification"
          ? this.config.emailVerificationTtlSeconds
          : this.config.passwordResetTtlSeconds,
    });

    if (purpose === "email-verification") {
      await this.dependencies.notifier.sendEmailVerification(user, record);
      return;
    }

    await this.dependencies.notifier.sendPasswordReset(user, record);
  }

  private async consumeToken(purpose: PadlockTokenPurpose, token: string) {
    const record = await this.dependencies.tokenStore.consume(purpose, token);
    if (!record) {
      throw new PadlockError("invalid-token", 422, "The provided token is invalid or expired.");
    }

    return record;
  }

  private async resolveCurrentUser(email: string): Promise<TUser | null> {
    if (typeof this.dependencies.guard.user === "function") {
      const user = await this.dependencies.guard.user<TUser>();
      if (user) {
        return user;
      }
    }

    return this.dependencies.userRepository.findByEmail(email);
  }

  private extractToken(): string | null {
    const guard = this.dependencies.guard as IAuthGuard & Partial<TokenAwareGuard>;
    return typeof guard.getToken === "function" ? guard.getToken() : null;
  }
}
