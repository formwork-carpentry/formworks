/**
 * @module @carpentry/crypto
 * @description Cryptographic primitives — token generation, HMAC signing,
 * constant-time comparison, random bytes, and digest utilities.
 *
 * Separate from @carpentry/encrypt (field-level AES encryption).
 * This package provides the low-level crypto building blocks used by auth,
 * session, CSRF, API keys, webhook signature verification, etc.
 *
 * Uses Node.js built-in crypto only — no external dependencies.
 *
 * @patterns Facade (wraps node:crypto with a safe, ergonomic API)
 * @principles SRP — crypto primitives only; no key storage or policy decisions
 *
 * @example
 * ```ts
 * import { generateToken, hmacSign, hmacVerify, constantTimeEqual } from '@carpentry/crypto';
 *
 * const token = generateToken(32);          // 64-char hex string
 * const sig   = hmacSign('sha256', secret, payload);
 * const ok    = hmacVerify('sha256', secret, payload, sig);
 * ```
 */

import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

// ── Token Generation ──────────────────────────────────────

/** Generate a cryptographically secure random hex token. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Generate a URL-safe base64 token (no +, /, or = characters). */
export function generateTokenBase64(bytes = 32): string {
  return randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Generate a UUID v4 (delegates to node:crypto). */
export function generateUuid(): string {
  return randomUUID();
}

/** Generate random bytes as a Buffer. */
export function secureRandomBytes(length: number): Buffer {
  return randomBytes(length);
}

// ── HMAC Signing ──────────────────────────────────────────

export type DigestAlgorithm = 'sha256' | 'sha384' | 'sha512';

/** Create an HMAC signature (hex-encoded). */
export function hmacSign(
  algorithm: DigestAlgorithm,
  secret: string | Buffer,
  data: string | Buffer,
): string {
  return createHmac(algorithm, secret).update(data).digest('hex');
}

/**
 * Verify an HMAC signature using constant-time comparison.
 * Returns false (never throws) if signatures don't match.
 */
export function hmacVerify(
  algorithm: DigestAlgorithm,
  secret: string | Buffer,
  data: string | Buffer,
  signature: string,
): boolean {
  const expected = hmacSign(algorithm, secret, data);
  return constantTimeEqual(expected, signature);
}

// ── Hashing ───────────────────────────────────────────────

/** Hash a string with the given algorithm (hex output). */
export function hash(algorithm: DigestAlgorithm | 'md5', data: string | Buffer): string {
  return createHash(algorithm).update(data).digest('hex');
}

/** SHA-256 hash (hex). */
export function sha256(data: string | Buffer): string {
  return hash('sha256', data);
}

/** SHA-512 hash (hex). */
export function sha512(data: string | Buffer): string {
  return hash('sha512', data);
}

// ── Constant-Time Comparison ──────────────────────────────

/**
 * Timing-safe string comparison. Prevents timing attacks on
 * token/signature verification.
 *
 * Returns false (never throws) for different-length strings.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Timing-safe Buffer comparison.
 */
export function constantTimeEqualBuffer(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
