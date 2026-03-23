/**
 * @module @carpentry/core/contracts/encrypt
 * @description Encryption contract — field-level encryption/decryption for sensitive data.
 *
 * Implementations: AesEncrypter (in @carpentry/encrypt)
 *
 * @example
 * ```ts
 * const encrypter = container.make<IEncrypter>('encrypt');
 * const encrypted = encrypter.encrypt('secret-data');
 * const decrypted = encrypter.decrypt(encrypted); // 'secret-data'
 * ```
 */

/** @typedef {Object} IEncrypter - Encryption/decryption contract */
export interface IEncrypter {
  /**
   * Encrypt a value.
   * @param {string} value - Plaintext value to encrypt
   * @returns {string} Encrypted value (typically base64-encoded with IV prepended)
   */
  encrypt(value: string): string;

  /**
   * Decrypt a value.
   * @param {string} encrypted - Encrypted value to decrypt
   * @returns {string} Original plaintext value
   * @throws if decryption fails (wrong key, corrupted data)
   */
  decrypt(encrypted: string): string;

  /**
   * Generate a fresh encryption key.
   * @returns {string} Base64-encoded key suitable for the configured cipher
   */
  generateKey(): string;
}
