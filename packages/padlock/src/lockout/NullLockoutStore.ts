/**
 * @module @carpentry/padlock/lockout
 * @description No-op lockout store when lockout is disabled.
 */

import type { IPadlockLockoutStore } from "../contracts.js";

/**
 * No-op lockout store. Never locks, never records attempts.
 */
export class NullLockoutStore implements IPadlockLockoutStore {
  async recordFailedAttempt(_key: string): Promise<number> {
    return 0;
  }

  async getAttempts(_key: string): Promise<number> {
    return 0;
  }

  async clearAttempts(_key: string): Promise<void> {
    // no-op
  }

  async isLocked(_key: string): Promise<boolean> {
    return false;
  }

  async getLockoutSeconds(_key: string): Promise<number> {
    return 0;
  }
}
