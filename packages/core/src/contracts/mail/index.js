/**
 * @module @formwork/core/contracts/mail
 * @description Mail adapter contract - all mail drivers implement this interface.
 *
 * Implementations: ArrayMailAdapter, LogMailAdapter, HttpMailAdapter, SmtpMailAdapter
 *
 * @example
 * ```ts
 * const mailer = container.make<IMailAdapter>('mail');
 * await mailer.send({ to: 'user@test.com', subject: 'Welcome!', html: '<p>Hello!</p>' });
 * ```
 */
export {};
//# sourceMappingURL=index.js.map