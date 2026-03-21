/**
 * @module @formwork/padlock/lockout
 * @description In-memory lockout store for failed login attempts.
 */

import type { IPadlockLockoutStore } from "../contracts.js";

interface LockoutState {
  attempts: number;
  lockedUntil: Date | null;
}

/**
 * In-memory lockout store. Use for tests or single-instance apps.
 */
export class MemoryLockoutStore implements IPadlockLockoutStore {
  private readonly state = new Map<string, LockoutState>();
  private readonly maxAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(maxAttempts = 5, lockoutMinutes = 1) {
    this.maxAttempts = maxAttempts;
    this.lockoutMinutes = lockoutMinutes;
  }

  private getState(key: string): LockoutState {
    let s = this.state.get(key);
    if (!s) {
      s = { attempts: 0, lockedUntil: null };
      this.state.set(key, s);
    }
    return s;
  }

  async recordFailedAttempt(key: string): Promise<number> {
    const s = this.getState(key);
    if (s.lockedUntil && s.lockedUntil.getTime() > Date.now()) {
      return s.attempts;
    }
    if (s.lockedUntil && s.lockedUntil.getTime() <= Date.now()) {
      s.attempts = 0;
      s.lockedUntil = null;
    }
    s.attempts += 1;
    if (s.attempts >= this.maxAttempts) {
      s.lockedUntil = new Date(Date.now() + this.lockoutMinutes * 60 * 1000);
    }
    return s.attempts;
  }

  async getAttempts(key: string): Promise<number> {
    const s = this.getState(key);
    if (s.lockedUntil && s.lockedUntil.getTime() <= Date.now()) {
      return 0;
    }
    return s.attempts;
  }

  async clearAttempts(key: string): Promise<void> {
    this.state.delete(key);
  }

  async isLocked(key: string): Promise<boolean> {
    const s = this.getState(key);
    return s.lockedUntil !== null && s.lockedUntil.getTime() > Date.now();
  }

  async getLockoutSeconds(key: string): Promise<number> {
    const s = this.getState(key);
    if (!s.lockedUntil || s.lockedUntil.getTime() <= Date.now()) {
      return 0;
    }
    return Math.ceil((s.lockedUntil.getTime() - Date.now()) / 1000);
  }
}
