/**
 * @module @carpentry/auth
 * @description Auth Guards — SessionGuard for web routes, MemoryGuard for testing
 * @patterns Strategy (guard implementations), Adapter
 * @principles LSP — all guards substitutable; DIP — depends on IUserProvider/IHashManager
 */

import type {
  AuthCredentials,
  IAuthGuard,
  IAuthenticatable,
  IHashManager,
  IUserProvider,
} from "@carpentry/formworks/core/contracts";

/**
 * MemoryGuard — keeps the authenticated user in memory (for tests and simple apps).
 *
 * `attempt()` uses {@link IUserProvider} + {@link IHashManager} like a real guard.
 *
 * @example
 * ```ts
 * import { HashManager } from '..';
 *
 * const hasher = new HashManager('sha256');
 * const provider = new InMemoryUserProvider();
 * provider.addUser(new SimpleUser(1, 'a@b.com', await hasher.make('secret')));
 * const guard = new MemoryGuard(provider, hasher);
 * await guard.attempt({ email: 'a@b.com', password: 'secret' });
 * ```
 */
export class MemoryGuard implements IAuthGuard {
  private currentUser: IAuthenticatable | null = null;

  constructor(
    private readonly provider: IUserProvider,
    private readonly hasher: IHashManager,
  ) {}

  async user<T = unknown>(): Promise<T | null> {
    return this.currentUser as T | null;
  }

  async check(): Promise<boolean> {
    return this.currentUser !== null;
  }

  async guest(): Promise<boolean> {
    return this.currentUser === null;
  }

  async id(): Promise<string | number | null> {
    return this.currentUser?.getAuthIdentifier() ?? null;
  }

  /**
   * @param {IAuthenticatable} user
   * @returns {Promise<void>}
   */
  async login(user: IAuthenticatable): Promise<void> {
    this.currentUser = user;
  }

  async logout(): Promise<void> {
    this.currentUser = null;
  }

  /**
   * @param {AuthCredentials} credentials
   * @returns {Promise<boolean>}
   */
  async attempt(credentials: AuthCredentials): Promise<boolean> {
    const user = await this.provider.findByCredentials(credentials);
    if (!user) return false;

    const password = credentials.password as string | undefined;
    if (!password) return false;

    const valid = await this.hasher.check(password, user.getAuthPassword());
    if (!valid) return false;

    await this.login(user);
    return true;
  }
}

// ── In-Memory User Provider (for testing) ─────────────────

/**
 * InMemoryUserProvider — registers {@link IAuthenticatable} users in an array.
 *
 * `retrieveByCredentials` matches on an `email` field on the user object.
 *
 * @example
 * ```ts
 * const p = new InMemoryUserProvider();
 * p.addUser(new SimpleUser(1, 'u@x.com', 'hash'));
 * const u = await p.retrieveByCredentials({ email: 'u@x.com' });
 * ```
 */
export class InMemoryUserProvider implements IUserProvider {
  private users: IAuthenticatable[] = [];

  /**
   * @param {IAuthenticatable} user
   */
  addUser(user: IAuthenticatable): void {
    this.users.push(user);
  }

  /**
   * @param {string | number} id
   * @returns {Promise<IAuthenticatable | null>}
   */
  async findById(id: string | number): Promise<IAuthenticatable | null> {
    return this.users.find((u) => u.getAuthIdentifier() === id) ?? null;
  }

  /**
   * @param {AuthCredentials} credentials
   * @returns {Promise<IAuthenticatable | null>}
   */
  async findByCredentials(credentials: AuthCredentials): Promise<IAuthenticatable | null> {
    const email = credentials.email as string | undefined;
    if (!email) return null;
    return (
      this.users.find((u) => {
        // Duck-type check for email attribute
        return (u as unknown as Record<string, unknown>).email === email;
      }) ?? null
    );
  }

  /**
   * @param {IAuthenticatable} user
   * @param {AuthCredentials} credentials
   * @returns {Promise<boolean>}
   */
  async validateCredentials(
    user: IAuthenticatable,
    credentials: AuthCredentials,
  ): Promise<boolean> {
    const password = credentials.password as string | undefined;
    return password === user.getAuthPassword();
  }
}

// ── Simple Authenticatable (for testing) ──────────────────

/**
 * SimpleUser — minimal {@link IAuthenticatable} for unit tests.
 *
 * `getAuthPassword()` returns the stored hash string (use with a real hasher in guards).
 *
 * @example
 * ```ts
 * const user = new SimpleUser(42, 'dev@local', '$sha256$...');
 * user.getAuthIdentifier(); // 42
 * ```
 */
export class SimpleUser implements IAuthenticatable {
  constructor(
    public readonly id: string | number,
    public readonly email: string,
    private readonly passwordHash: string,
    public readonly role: string = "user",
  ) {}

  getAuthIdentifier(): string | number {
    return this.id;
  }
  getAuthPassword(): string {
    return this.passwordHash;
  }
}
