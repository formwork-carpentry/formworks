/**
 * @module @carpentry/auth
 * @description HashManager — Strategy pattern for password hashing
 * @patterns Strategy (hash drivers)
 * @principles DIP — app code depends on IHashManager; OCP — new drivers via registerDriver
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { IHashManager } from "@carpentry/formworks/contracts";

/**
 * Sha256HashDriver — salted SHA-256 hashing for tests and non-production use.
 *
 * Prefer bcrypt/argon2 in production; this driver exists so `HashManager` works out of the box.
 *
 * @example
 * ```ts
 * const driver = new Sha256HashDriver();
 * const h = await driver.make('password');
 * expect(await driver.check('password', h)).toBe(true);
 * ```
 */
export class Sha256HashDriver implements IHashManager {
  /**
   * @param {string} value
   * @returns {Promise<string>}
   */
  async make(value: string): Promise<string> {
    const salt = createHash("sha256")
      .update(String(Date.now()) + Math.random())
      .digest("hex")
      .slice(0, 16);
    const hash = createHash("sha256")
      .update(salt + value)
      .digest("hex");
    return `$sha256$${salt}$${hash}`;
  }

  /**
   * @param {string} value
   * @param {string} hashedValue
   * @returns {Promise<boolean>}
   */
  async check(value: string, hashedValue: string): Promise<boolean> {
    const parts = hashedValue.split("$");
    if (parts.length !== 4 || parts[1] !== "sha256") return false;
    const salt = parts[2];
    const expectedHash = parts[3];
    if (salt === undefined || expectedHash === undefined) return false;
    const actualHash = createHash("sha256")
      .update(salt + value)
      .digest("hex");
    // Timing-safe comparison
    try {
      return timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(actualHash, "hex"));
    } catch {
      return false;
    }
  }

  /**
   * @returns {boolean}
   */
  needsRehash(_hashedValue: string): boolean {
    return false;
  }
}

/**
 * Hash manager that delegates hashing/verification to a selected driver.
 *
 * Register custom drivers (bcrypt/argon2/etc.) with {@link registerDriver}, then use
 * {@link make}, {@link check}, and {@link needsRehash} through the configured default driver.
 *
 * @example
 * ```ts
 * import { HashManager, Sha256HashDriver } from '..';
 *
 * const hashes = new HashManager('sha256');
 * hashes.registerDriver('sha256', new Sha256HashDriver());
 *
 * const hashed = await hashes.make('secret');
 * const ok = await hashes.check('secret', hashed);
 * ```
 *
 * @see Sha256HashDriver — Built-in SHA-256 driver (primarily for tests)
 */
export class HashManager implements IHashManager {
  private drivers = new Map<string, IHashManager>();
  private defaultDriver: string;

  constructor(defaultDriver = "sha256") {
    this.defaultDriver = defaultDriver;
    this.registerDriver("sha256", new Sha256HashDriver());
  }

  /**
   * @param {string} name
   * @param {IHashManager} driver
   */
  registerDriver(name: string, driver: IHashManager): void {
    this.drivers.set(name, driver);
  }

  /**
   * @param {string} [name]
   * @returns {IHashManager}
   */
  driver(name?: string): IHashManager {
    const d = this.drivers.get(name ?? this.defaultDriver);
    if (!d) throw new Error(`Hash driver "${name ?? this.defaultDriver}" not registered.`);
    return d;
  }

  /**
   * @param {string} value
   * @returns {Promise<string>}
   */
  async make(value: string): Promise<string> {
    return this.driver().make(value);
  }
  /**
   * @param {string} value
   * @param {string} hashed
   * @returns {Promise<boolean>}
   */
  async check(value: string, hashed: string): Promise<boolean> {
    return this.driver().check(value, hashed);
  }
  /**
   * @param {string} hashed
   * @returns {boolean}
   */
  needsRehash(hashed: string): boolean {
    return this.driver().needsRehash(hashed);
  }
}
