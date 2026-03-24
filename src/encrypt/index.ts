/**
 * @module @carpentry/encrypt
 * @description Field-level encryption — AES-256-GCM encrypt/decrypt for sensitive data.
 * Uses Node.js built-in crypto (no external dependencies).
 *
 * Implements the IEncrypter contract from @carpentry/core/contracts/encrypt.
 *
 * @patterns Adapter (implements IEncrypter via Node.js crypto)
 * @principles SRP (encryption concerns only), ISP (minimal IEncrypter interface)
 *
 * @example
 * ```ts
 * import { AesEncrypter } from './';
 *
 * const encrypter = new AesEncrypter({ key: process.env.APP_KEY! });
 * const encrypted = encrypter.encrypt('secret-value');
 * const decrypted = encrypter.decrypt(encrypted); // 'secret-value'
 * ```
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { IEncrypter } from '../contracts';

export type { IEncrypter } from '../contracts';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/** Configuration for AesEncrypter. */
export interface EncryptConfig {
  /** Base64-encoded 256-bit (32-byte) key */
  key: string;
}

/**
 * Field-level AES-256-GCM encrypter using APP_KEY by default.
 */
export class FieldEncryptor implements IEncrypter {
  private readonly key: Buffer;

  constructor(config?: Partial<EncryptConfig>) {
    const source = config?.key ?? process.env.APP_KEY;
    if (!source) {
      throw new Error('Missing APP_KEY for FieldEncryptor.');
    }

    const normalized = source.startsWith('base64:') ? source.slice('base64:'.length) : source;
    const maybeBase64 = Buffer.from(normalized, 'base64');
    this.key = maybeBase64.length === 32
      ? maybeBase64
      : createHash('sha256').update(normalized, 'utf8').digest();
  }

  encrypt(value: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: base64(iv + authTag + ciphertext)
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(encrypted: string): string {
    const data = Buffer.from(encrypted, 'base64');
    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted value: too short');
    }
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  generateKey(): string {
    return randomBytes(32).toString('base64');
  }

  /** Static helper to generate a new key without instantiation. */
  static generateKey(): string {
    return randomBytes(32).toString('base64');
  }
}

/** Backward compatibility alias. */
export class AesEncrypter extends FieldEncryptor {}
