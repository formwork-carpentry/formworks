/**
 * @module @carpentry/mail
 * @description MailManager — resolves mail adapters by name, Mail facade.
 * Extends {@link CarpenterFactoryBase} for shared driver registration, lazy resolution, and instance caching.
 *
 * @patterns Abstract Factory, Strategy
 * @principles DIP — app sends via IMailAdapter; OCP — new drivers via registerDriver
 *             DRY — shared resolution logic via CarpenterFactoryBase
 */

import { CarpenterFactoryBase } from "@carpentry/formworks/core/adapters";
import type { IMailAdapter, MailMessage } from "@carpentry/formworks/core/contracts";
import { ArrayMailAdapter, type BaseMailable, LogMailAdapter } from "../adapters/Adapters.js";

export interface MailDriverConfig {
  driver: string;
  [key: string]: unknown;
}

export type MailDriverFactory = (config: MailDriverConfig) => IMailAdapter;

/**
 * MailManager resolves configured mail adapters (drivers) and delivers messages.
 *
 * Typical workflow:
 * - Create a `MailManager` with a default mailer
 * - Register/resolve extra drivers via `registerDriver()` / configuration
 * - Bind it once with `setMailManager()` so the global {@link Mail} facade works
 *
 * @example
 * ```ts
 * import { MailManager, setMailManager, Mail } from '..';
 *
 * const manager = new MailManager('log', {
 *   log: { driver: 'log' },
 * });
 *
 * setMailManager(manager);
 *
 * await Mail.send({
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   body: 'Hello!',
 * });
 * ```
 *
 * @see Mail — Global facade helper
 * @see BaseMailable — Compose messages via mailable classes
 * @see CarpenterFactoryBase — shared driver registration and resolution
 */
export class MailManager extends CarpenterFactoryBase<IMailAdapter, MailDriverConfig> {
  protected readonly resolverLabel = "mailer";
  protected readonly domainLabel = "Mail";
  private fakeAdapter: ArrayMailAdapter | null = null;

  constructor(defaultMailer = "log", configs: Record<string, MailDriverConfig> = {}) {
    super(defaultMailer, configs);
    this.registerDriver("array", () => new ArrayMailAdapter());
    this.registerDriver("log", () => new LogMailAdapter());
  }

  /**
   * @param {string} [name]
   * @returns {IMailAdapter}
   */
  mailer(name?: string): IMailAdapter {
    if (this.fakeAdapter) return this.fakeAdapter;
    return this.resolve(name);
  }

  /**
   * Backward-compatible registration API used by legacy starters.
   * Registers a concrete transport instance under the given driver name.
   */
  addTransport(name: string, transport: IMailAdapter): this {
    return this.registerDriver(name, () => transport);
  }

  /** Send a mail message */
  /**
   * @param {MailMessage} message
   * @returns {Promise<void>}
   */
  async send(message: MailMessage): Promise<void> {
    return this.mailer().send(message);
  }

  /** Send a mailable */
  /**
   * @param {BaseMailable} mailable
   * @returns {Promise<void>}
   */
  async sendMailable(mailable: BaseMailable): Promise<void> {
    return this.mailer().send(mailable.toMessage());
  }

  /** Replace all mailers with ArrayMailAdapter for testing */
  fake(): ArrayMailAdapter {
    this.fakeAdapter = new ArrayMailAdapter();
    return this.fakeAdapter;
  }

  /** Restore real mailers */
  unfake(): void {
    this.fakeAdapter = null;
  }
}

// ── Facade ────────────────────────────────────────────────

let globalMailManager: MailManager | null = null;
/**
 * @param {MailManager} m
 */
export function setMailManager(m: MailManager): void {
  globalMailManager = m;
}

export const Mail = {
  send: (msg: MailMessage) => getManager().send(msg),
  sendMailable: (m: BaseMailable) => getManager().sendMailable(m),
  mailer: (name?: string) => getManager().mailer(name),
  fake: () => getManager().fake(),
  unfake: () => getManager().unfake(),
};

function getManager(): MailManager {
  /**
   * @param {unknown} !globalMailManager
   */
  if (!globalMailManager) throw new Error("MailManager not initialized.");
  return globalMailManager;
}
