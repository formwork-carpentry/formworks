/**
 * @module @formwork/padlock/notifiers
 * @description Built-in Padlock notifier implementations for no-op usage and testing.
 * @patterns Null Object, Test Double
 * @principles SRP - token delivery concerns remain behind notifier implementations.
 */

import type { IAuthenticatable } from "@formwork/core/contracts";
import type { IPadlockNotifier, PadlockTokenRecord } from "./contracts.js";

/**
 * No-op notifier used when applications do not want token delivery side effects.
 */
export class NullPadlockNotifier<TUser extends IAuthenticatable = IAuthenticatable>
  implements IPadlockNotifier<TUser>
{
  async sendEmailVerification(_user: TUser, _token: PadlockTokenRecord): Promise<void> {}

  async sendPasswordReset(_user: TUser, _token: PadlockTokenRecord): Promise<void> {}
}

/**
 * Test notifier that records token deliveries for assertions.
 */
export class PadlockNotifierFake<TUser extends IAuthenticatable = IAuthenticatable>
  implements IPadlockNotifier<TUser>
{
  readonly emailVerifications: Array<{ user: TUser; token: PadlockTokenRecord }> = [];
  readonly passwordResets: Array<{ user: TUser; token: PadlockTokenRecord }> = [];

  async sendEmailVerification(user: TUser, token: PadlockTokenRecord): Promise<void> {
    this.emailVerifications.push({ user, token });
  }

  async sendPasswordReset(user: TUser, token: PadlockTokenRecord): Promise<void> {
    this.passwordResets.push({ user, token });
  }

  /**
   * Reset captured notifications.
   */
  clear(): void {
    this.emailVerifications.length = 0;
    this.passwordResets.length = 0;
  }
}
