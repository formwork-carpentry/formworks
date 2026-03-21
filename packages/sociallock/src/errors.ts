/**
 * @module @formwork/sociallock/errors
 * @description Domain errors for SocialLock.
 */

export type SocialLockErrorCode = "invalid-provider" | "invalid-state" | "provider-error";

export class SocialLockError extends Error {
  constructor(
    public readonly code: SocialLockErrorCode,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "SocialLockError";
  }
}
