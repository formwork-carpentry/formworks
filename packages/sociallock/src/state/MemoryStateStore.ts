/**
 * @module @carpentry/sociallock/state
 * @description In-memory OAuth state store for CSRF protection.
 */

import { randomBytes } from "node:crypto";
import type { IStateStore, SocialLockStateMetadata } from "../contracts.js";

interface StoredStateRecord {
  provider: string;
  expiresAt: number;
}

export class MemoryStateStore implements IStateStore {
  private readonly store = new Map<string, StoredStateRecord>();
  private readonly ttlMs: number;

  constructor(ttlSeconds = 600) {
    this.ttlMs = ttlSeconds * 1000;
  }

  async put(state: string, metadata?: SocialLockStateMetadata): Promise<void> {
    this.store.set(state, {
      provider: metadata?.provider ?? "",
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  async consume(state: string): Promise<SocialLockStateMetadata | null> {
    const entry = this.store.get(state);
    this.store.delete(state);

    if (!entry || entry.expiresAt < Date.now()) {
      return null;
    }

    return { provider: entry.provider };
  }
}

export function generateState(): string {
  return randomBytes(32).toString("hex");
}
