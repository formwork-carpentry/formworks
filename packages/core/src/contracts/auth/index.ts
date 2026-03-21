/**
 * @module @formwork/core/contracts/auth
 * @description Authentication contracts - guard and user provider interfaces.
 *
 * Implementations: JwtGuard, MemoryGuard, InMemoryUserProvider
 *
 * @example
 * ```ts
 * const guard = container.make<IAuthGuard>('auth');
 * const ok = await guard.attempt({ email: 'user@test.com', password: 'secret' });
 * if (ok) console.log('User ID:', await guard.id());
 * ```
 */

/** Reusable credential bag for authentication attempts and provider lookups. */
export type AuthCredentials = Record<string, unknown>;

/** @typedef {Object} IAuthGuard - Authentication guard contract */
export interface IAuthGuard {
  /**
   * Attempt to authenticate with credentials.
   * @param {AuthCredentials} credentials - Login credentials (e.g., { email, password })
   * @returns {Promise<boolean>} True if authentication succeeded
   */
  attempt(credentials: AuthCredentials): Promise<boolean>;

  /**
   * Check if a user is currently authenticated.
   * @returns {Promise<boolean>}
   */
  check(): Promise<boolean>;

  /**
   * Check if the guard currently has no authenticated user.
   * @returns {Promise<boolean>}
   */
  guest?(): Promise<boolean>;

  /**
   * Get the authenticated user instance.
   * @returns {Promise<T | null>}
   */
  user?<T = unknown>(): Promise<T | null>;

  /**
   * Get the authenticated user's ID.
   * @returns {Promise<string | number | null>} User ID or null
   */
  id(): Promise<string | number | null>;

  /**
   * Log in an authenticatable user.
   * @param {IAuthenticatable} user
   * @returns {Promise<void>}
   */
  login?(user: IAuthenticatable): Promise<void>;

  /**
   * Log the current user out.
   * @returns {Promise<void>}
   */
  logout(): Promise<void>;
}

/** @typedef {Object} IUserProvider - User lookup provider contract */
export interface IUserProvider {
  /**
   * Find a user by their unique identifier.
   * @param {string | number} id - User ID
   * @returns {Promise<IAuthenticatable | null>} User or null
   */
  findById(id: string | number): Promise<IAuthenticatable | null>;

  /**
   * Find a user by credentials (e.g., email lookup).
   * @param {AuthCredentials} credentials - Lookup fields
   * @returns {Promise<IAuthenticatable | null>} User or null
   */
  findByCredentials(credentials: AuthCredentials): Promise<IAuthenticatable | null>;

  /**
   * Validate credentials against a user record.
   * @param {IAuthenticatable} user - The user to validate against
   * @param {AuthCredentials} credentials - Credentials to check
   * @returns {Promise<boolean>} True if credentials match
   */
  validateCredentials(user: IAuthenticatable, credentials: AuthCredentials): Promise<boolean>;
}

/** @typedef {Object} IAuthenticatable - Authenticated user contract */
export interface IAuthenticatable {
  /** @returns {string | number} Unique user identifier */
  getAuthIdentifier(): string | number;
  /** @returns {string} Hashed password */
  getAuthPassword(): string;
}

/** Gate callback signature used for ability definitions. */
export type GateCallback = (
  user: IAuthenticatable,
  ...args: unknown[]
) => boolean | Promise<boolean>;

/** Authorization gate contract. */
export interface IGate {
  /**
   * Define an ability callback.
   * @param {string} ability
   * @param {GateCallback} callback
   * @returns {void}
   */
  define(ability: string, callback: GateCallback): void;

  /**
   * Associate a model class with a policy class.
   * @param {Function} modelClass
   * @param {Function} policyClass
   * @returns {void}
   */
  // biome-ignore lint/complexity/noBannedTypes: Function types used for model and policy class references
  policy(modelClass: Function, policyClass: Function): void;

  /**
   * Register a before hook that can short-circuit authorization checks.
   * @param {(user: IAuthenticatable, ability: string) => boolean | null | Promise<boolean | null>} callback
   * @returns {void}
   */
  before(
    callback: (user: IAuthenticatable, ability: string) => boolean | null | Promise<boolean | null>,
  ): void;

  /**
   * Determine whether a user is allowed to perform an ability.
   * @param {IAuthenticatable} user
   * @param {string} ability
   * @param {unknown[]} args
   * @returns {Promise<boolean>}
   */
  allows(user: IAuthenticatable, ability: string, ...args: unknown[]): Promise<boolean>;

  /**
   * Determine whether a user is denied an ability.
   * @param {IAuthenticatable} user
   * @param {string} ability
   * @param {unknown[]} args
   * @returns {Promise<boolean>}
   */
  denies(user: IAuthenticatable, ability: string, ...args: unknown[]): Promise<boolean>;
}

/** Password hashing contract used by guards and auth infrastructure. */
export interface IHashManager {
  /**
   * Create a hashed representation of a plain-text value.
   * @param {string} value
   * @returns {Promise<string>}
   */
  make(value: string): Promise<string>;

  /**
   * Verify a plain-text value against a stored hash.
   * @param {string} value
   * @param {string} hashedValue
   * @returns {Promise<boolean>}
   */
  check(value: string, hashedValue: string): Promise<boolean>;

  /**
   * Determine whether an existing hash should be regenerated.
   * @param {string} hashedValue
   * @returns {boolean}
   */
  needsRehash(hashedValue: string): boolean;
}
