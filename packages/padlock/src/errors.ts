/**
 * @module @carpentry/padlock/errors
 * @description Domain errors raised by the Padlock workflow layer.
 * @patterns Value Object
 * @principles SRP - centralizes workflow error codes and HTTP-friendly status metadata.
 */

/**
 * Stable Padlock workflow error codes.
 */
export type PadlockErrorCode =
  | "duplicate-email"
  | "invalid-credentials"
  | "invalid-token"
  | "user-not-found"
  | "unauthenticated"
  | "two-factor-required"
  | "invalid-two-factor-code"
  | "account-locked"
  | "password-confirmation-required"
  | "invalid-password"
  | "two-factor-already-enabled"
  | "two-factor-not-enabled";

/**
 * Error type raised by Padlock services and mapped by the HTTP adapter.
 */
export class PadlockError extends Error {
  constructor(
    public readonly code: PadlockErrorCode,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "PadlockError";
  }
}
