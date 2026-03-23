/**
 * @module @carpentry/mail
 * @description Mail manager with pluggable adapters (in-memory array, log, HTTP, SMTP via external).
 *
 * Use this package to:
 * - Send raw `MailMessage` payloads or higher-level {@link BaseMailable}s
 * - Swap mail backends via driver configuration (`MailManager.mailer()`)
 * - Test mail flows with in-memory test doubles via `Mail.fake()` / `Mail.unfake()`
 *
 * @example
 * ```ts
 * import { MailManager, setMailManager, Mail, BaseMailable } from './';
 *
 * const mailManager = new MailManager('log', {
 *   log: { driver: 'log' },
 * });
 * setMailManager(mailManager);
 *
 * await Mail.send({
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   body: 'Hello from Carpenter!',
 * });
 * ```
 *
 * @see MailManager — Mail adapter resolver
 * @see Mail — Global facade for the configured manager
 */

export { ArrayMailAdapter, ArrayMailAdapter as InMemoryMailTransport, LogMailAdapter, BaseMailable } from "./adapters/Adapters.js";
export { MailManager, setMailManager, Mail, createMailManager } from "./manager/index.js";
export type { MailDriverFactory, MailManagerFactoryOptions } from "./manager/index.js";

export { HttpMailAdapter } from "./adapters/HttpMailAdapter.js";
export type { HttpMailConfig, HttpMailProvider, SendResult } from "./adapters/HttpMailAdapter.js";
