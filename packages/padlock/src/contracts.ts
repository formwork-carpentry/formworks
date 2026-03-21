/**
 * @module @formwork/padlock/contracts
 * @description Public contracts for the Padlock workflow layer.
 */

import type { IAuthenticatable, IHashManager } from "@formwork/core/contracts";

export type PadlockTokenPurpose = "email-verification" | "password-reset" | "two-factor-challenge";

export interface PadlockConfig {
  autoLoginOnRegistration?: boolean;
  sendEmailVerificationOnRegistration?: boolean;
  emailVerificationTtlSeconds?: number;
  passwordResetTtlSeconds?: number;
  lockoutMaxAttempts?: number;
  lockoutMinutes?: number;
  passwordConfirmationTtlSeconds?: number;
  twoFactorRecoveryCodesCount?: number;
  twoFactorIssuer?: string;
  twoFactorChallengeTtlSeconds?: number;
}

export interface PadlockRegistrationInput extends Record<string, unknown> {
  email: string;
  password: string;
}

export interface PadlockLoginInput {
  email: string;
  password: string;
}

export interface PadlockPasswordResetRequestInput {
  email: string;
}

export interface PadlockPasswordResetInput {
  token: string;
  password: string;
}

export interface PadlockChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface PadlockDispatchResult {
  dispatched: boolean;
}

export interface PadlockAuthResult<TUser extends IAuthenticatable = IAuthenticatable> {
  user: TUser;
  token: string | null;
}

export interface PadlockTwoFactorChallengeResult {
  needsTwoFactor: true;
  challengeToken: string;
  expiresInSeconds: number;
}

export interface PadlockTwoFactorSetupResult {
  secret: string;
  qrCodeUrl: string;
  recoveryCodes: string[];
}

export interface CreatePadlockUserInput extends Record<string, unknown> {
  email: string;
  passwordHash: string;
  emailVerifiedAt?: Date | null;
  name?: string | null;
}

export interface PadlockTokenRecord {
  token: string;
  purpose: PadlockTokenPurpose;
  userId: string | number;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface CreatePadlockTokenInput {
  purpose: PadlockTokenPurpose;
  userId: string | number;
  ttlSeconds: number;
}

export interface IPadlockUserRepository<TUser extends IAuthenticatable = IAuthenticatable> {
  findByEmail(email: string): Promise<TUser | null>;
  findById(id: string | number): Promise<TUser | null>;
  create(input: CreatePadlockUserInput): Promise<TUser>;
  updatePassword(userId: string | number, passwordHash: string): Promise<TUser | null>;
  markEmailVerified(userId: string | number, verifiedAt: Date): Promise<TUser | null>;
  isEmailVerified(userId: string | number): Promise<boolean>;
}

export interface IPadlockTokenStore {
  issue(input: CreatePadlockTokenInput): Promise<PadlockTokenRecord>;
  consume(purpose: PadlockTokenPurpose, token: string): Promise<PadlockTokenRecord | null>;
  revokeForUser(purpose: PadlockTokenPurpose, userId: string | number): Promise<void>;
}

export interface IPadlockNotifier<TUser extends IAuthenticatable = IAuthenticatable> {
  sendEmailVerification(user: TUser, token: PadlockTokenRecord): Promise<void>;
  sendPasswordReset(user: TUser, token: PadlockTokenRecord): Promise<void>;
}

export interface IPadlockTwoFactorStore {
  getSecret(userId: string | number): Promise<string | null>;
  setPendingSecret(userId: string | number, secret: string): Promise<void>;
  getPendingSecret(userId: string | number): Promise<string | null>;
  confirmAndEnable(userId: string | number): Promise<void>;
  removeSecret(userId: string | number): Promise<void>;
  isEnabled(userId: string | number): Promise<boolean>;
  setRecoveryCodes(userId: string | number, hashedCodes: string[]): Promise<void>;
  consumeRecoveryCode(
    userId: string | number,
    code: string,
    hasher: Pick<IHashManager, "check">,
  ): Promise<boolean>;
}

export interface IPadlockLockoutStore {
  recordFailedAttempt(key: string): Promise<number>;
  getAttempts(key: string): Promise<number>;
  clearAttempts(key: string): Promise<void>;
  isLocked(key: string): Promise<boolean>;
  getLockoutSeconds(key: string): Promise<number>;
}

export interface ITotpProvider {
  generateSecret(): string;
  generate(secret: string): Promise<string>;
  verify(secret: string, token: string): Promise<boolean>;
  otpauthUrl(secret: string, accountName: string, issuer?: string): string;
}
