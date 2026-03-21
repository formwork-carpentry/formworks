/**
 * @module @formwork/padlock/twofactor
 * @description In-memory 2FA store for testing and simple setups.
 */

import type { IPadlockTwoFactorStore } from "../contracts.js";

interface TwoFactorState {
  secret: string | null;
  pendingSecret: string | null;
  recoveryCodes: string[];
}

/**
 * In-memory 2FA store. Use for tests or single-instance apps.
 */
export class MemoryTwoFactorStore implements IPadlockTwoFactorStore {
  private readonly state = new Map<string | number, TwoFactorState>();

  private getState(userId: string | number): TwoFactorState {
    let s = this.state.get(userId);
    if (!s) {
      s = { secret: null, pendingSecret: null, recoveryCodes: [] };
      this.state.set(userId, s);
    }
    return s;
  }

  async getSecret(userId: string | number): Promise<string | null> {
    return this.getState(userId).secret;
  }

  async setPendingSecret(userId: string | number, secret: string): Promise<void> {
    const s = this.getState(userId);
    s.pendingSecret = secret;
  }

  async getPendingSecret(userId: string | number): Promise<string | null> {
    return this.getState(userId).pendingSecret;
  }

  async confirmAndEnable(userId: string | number): Promise<void> {
    const s = this.getState(userId);
    if (!s.pendingSecret) {
      throw new Error("No pending 2FA secret to confirm.");
    }
    s.secret = s.pendingSecret;
    s.pendingSecret = null;
  }

  async removeSecret(userId: string | number): Promise<void> {
    this.state.delete(userId);
  }

  async isEnabled(userId: string | number): Promise<boolean> {
    return this.getState(userId).secret !== null;
  }

  async setRecoveryCodes(userId: string | number, hashedCodes: string[]): Promise<void> {
    this.getState(userId).recoveryCodes = [...hashedCodes];
  }

  async consumeRecoveryCode(
    userId: string | number,
    code: string,
    hasher: { check: (plain: string, hashed: string) => Promise<boolean> },
  ): Promise<boolean> {
    const s = this.getState(userId);
    for (let i = 0; i < s.recoveryCodes.length; i++) {
      if (await hasher.check(code, s.recoveryCodes[i])) {
        s.recoveryCodes.splice(i, 1);
        return true;
      }
    }
    return false;
  }
}
