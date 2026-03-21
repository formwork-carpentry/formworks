/**
 * @module @formwork/padlock/testing
 * @description In-memory testing doubles for Padlock user persistence and token storage.
 * @patterns Repository, Test Double
 * @principles SRP - testing doubles stay package-owned and implement the same public Padlock contracts.
 */

import { randomBytes } from "node:crypto";
import type {
  AuthCredentials,
  IAuthenticatable,
  IHashManager,
  IUserProvider,
} from "@formwork/core/contracts";
import type {
  CreatePadlockTokenInput,
  CreatePadlockUserInput,
  IPadlockTokenStore,
  IPadlockUserRepository,
  PadlockTokenPurpose,
  PadlockTokenRecord,
} from "./contracts.js";

/**
 * In-memory user entity used by the Padlock testing repository.
 */
export class InMemoryPadlockUser implements IAuthenticatable {
  constructor(
    public readonly id: string | number,
    public readonly email: string,
    public readonly name: string | null,
    private passwordHash: string,
    public emailVerifiedAt: Date | null = null,
    public readonly attributes: Record<string, unknown> = {},
  ) {}

  /**
   * Read the user's auth identifier.
   *
   * @returns User identifier.
   */
  getAuthIdentifier(): string | number {
    return this.id;
  }

  /**
   * Read the current password hash.
   *
   * @returns Stored password hash.
   */
  getAuthPassword(): string {
    return this.passwordHash;
  }

  /**
   * Replace the stored password hash.
   *
   * @param hash - New password hash.
   */
  setPasswordHash(hash: string): void {
    this.passwordHash = hash;
  }

  /**
   * Convert the user to a safe JSON payload.
   *
   * @returns Safe user payload without the password hash.
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      emailVerifiedAt: this.emailVerifiedAt?.toISOString() ?? null,
      ...this.attributes,
    };
  }
}

/**
 * In-memory user repository that also satisfies the auth user-provider contract.
 */
export class InMemoryPadlockUserRepository
  implements IPadlockUserRepository<InMemoryPadlockUser>, IUserProvider
{
  private readonly users = new Map<string | number, InMemoryPadlockUser>();
  private nextId = 1;

  constructor(private readonly hasher: IHashManager) {}

  /**
   * Seed a user into the in-memory store.
   *
   * @param user - User to persist.
   */
  addUser(user: InMemoryPadlockUser): void {
    this.users.set(user.getAuthIdentifier(), user);
    const numericId = typeof user.id === "number" ? user.id : 0;
    this.nextId = Math.max(this.nextId, numericId + 1);
  }

  async findByEmail(email: string): Promise<InMemoryPadlockUser | null> {
    return this.findByCredentials({ email });
  }

  async findById(id: string | number): Promise<InMemoryPadlockUser | null> {
    return this.users.get(id) ?? null;
  }

  async create(input: CreatePadlockUserInput): Promise<InMemoryPadlockUser> {
    const user = new InMemoryPadlockUser(
      this.nextId++,
      input.email,
      typeof input.name === "string" ? input.name : null,
      input.passwordHash,
      input.emailVerifiedAt ?? null,
      collectExtraAttributes(input),
    );
    this.users.set(user.getAuthIdentifier(), user);
    return user;
  }

  async updatePassword(
    userId: string | number,
    passwordHash: string,
  ): Promise<InMemoryPadlockUser | null> {
    const user = this.users.get(userId) ?? null;
    if (!user) {
      return null;
    }

    user.setPasswordHash(passwordHash);
    return user;
  }

  async markEmailVerified(
    userId: string | number,
    verifiedAt: Date,
  ): Promise<InMemoryPadlockUser | null> {
    const user = this.users.get(userId) ?? null;
    if (!user) {
      return null;
    }

    user.emailVerifiedAt = verifiedAt;
    return user;
  }

  async isEmailVerified(userId: string | number): Promise<boolean> {
    return (this.users.get(userId)?.emailVerifiedAt ?? null) !== null;
  }

  async findByCredentials(credentials: AuthCredentials): Promise<InMemoryPadlockUser | null> {
    const email = credentials.email;
    if (typeof email !== "string") {
      return null;
    }

    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }

    return null;
  }

  async retrieveById(id: string | number): Promise<InMemoryPadlockUser | null> {
    return this.findById(id);
  }

  async retrieveByCredentials(credentials: AuthCredentials): Promise<InMemoryPadlockUser | null> {
    return this.findByCredentials(credentials);
  }

  async validateCredentials(
    user: IAuthenticatable,
    credentials: AuthCredentials,
  ): Promise<boolean> {
    const password = credentials.password;
    if (typeof password !== "string") {
      return false;
    }

    return this.hasher.check(password, user.getAuthPassword());
  }

  /**
   * Reset all persisted users.
   */
  clear(): void {
    this.users.clear();
    this.nextId = 1;
  }
}

/**
 * In-memory token store used by Padlock tests and simple demos.
 */
export class MemoryPadlockTokenStore implements IPadlockTokenStore {
  private readonly tokens = new Map<string, PadlockTokenRecord>();

  constructor(
    private readonly tokenFactory: () => string = () => randomBytes(24).toString("hex"),
    private readonly nowFactory: () => Date = () => new Date(),
  ) {}

  async issue(input: CreatePadlockTokenInput): Promise<PadlockTokenRecord> {
    const issuedAt = this.nowFactory();
    const record: PadlockTokenRecord = {
      token: this.tokenFactory(),
      purpose: input.purpose,
      userId: input.userId,
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + input.ttlSeconds * 1000),
      consumedAt: null,
    };
    this.tokens.set(this.key(input.purpose, record.token), record);
    return record;
  }

  async consume(purpose: PadlockTokenPurpose, token: string): Promise<PadlockTokenRecord | null> {
    const record = this.tokens.get(this.key(purpose, token)) ?? null;
    if (!record) {
      return null;
    }

    if (record.consumedAt !== null || record.expiresAt.getTime() <= this.nowFactory().getTime()) {
      this.tokens.delete(this.key(purpose, token));
      return null;
    }

    record.consumedAt = this.nowFactory();
    return record;
  }

  async revokeForUser(purpose: PadlockTokenPurpose, userId: string | number): Promise<void> {
    for (const [key, record] of this.tokens.entries()) {
      if (record.purpose === purpose && record.userId === userId) {
        this.tokens.delete(key);
      }
    }
  }

  /**
   * Read a token without consuming it. Intended for tests.
   *
   * @param purpose - Token purpose.
   * @param token - Raw token value.
   * @returns Matching token record or `null`.
   */
  peek(purpose: PadlockTokenPurpose, token: string): PadlockTokenRecord | null {
    return this.tokens.get(this.key(purpose, token)) ?? null;
  }

  /**
   * Reset all stored tokens.
   */
  clear(): void {
    this.tokens.clear();
  }

  private key(purpose: PadlockTokenPurpose, token: string): string {
    return `${purpose}:${token}`;
  }
}

function collectExtraAttributes(input: CreatePadlockUserInput): Record<string, unknown> {
  const { email, passwordHash, emailVerifiedAt, name, ...rest } = input;
  return rest;
}
