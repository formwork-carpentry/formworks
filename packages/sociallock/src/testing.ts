/**
 * @module @carpentry/sociallock/testing
 * @description In-memory testing doubles for SocialLock.
 */

import type { IAuthenticatable } from "@carpentry/core/contracts";
import type { ISocialUserRepository, SocialUserProfile } from "./contracts.js";

export class InMemorySocialUser implements IAuthenticatable {
  constructor(
    public readonly id: number,
    public readonly email: string | null,
    public readonly name: string | null,
    public readonly provider: string,
    public readonly providerId: string,
    private readonly passwordHash = "",
  ) {}

  getAuthIdentifier(): number {
    return this.id;
  }

  getAuthPassword(): string {
    return this.passwordHash;
  }
}

export class InMemorySocialUserRepository
  implements ISocialUserRepository<InMemorySocialUser>
{
  private readonly users = new Map<string, InMemorySocialUser>();
  private nextId = 1;

  async findByProvider(
    provider: string,
    providerId: string,
  ): Promise<InMemorySocialUser | null> {
    return this.users.get(`${provider}:${providerId}`) ?? null;
  }

  async createFromSocial(
    provider: string,
    profile: SocialUserProfile,
  ): Promise<InMemorySocialUser> {
    const user = new InMemorySocialUser(
      this.nextId++,
      profile.email,
      profile.name,
      provider,
      profile.id,
    );
    this.users.set(`${provider}:${profile.id}`, user);
    return user;
  }

  clear(): void {
    this.users.clear();
    this.nextId = 1;
  }
}
