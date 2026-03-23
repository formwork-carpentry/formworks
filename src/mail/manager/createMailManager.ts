import { HttpMailAdapter } from "../adapters/HttpMailAdapter.js";
import { type MailDriverConfig, MailManager } from "./MailManager.js";

export interface MailManagerFactoryOptions {
  fromAddress?: string;
}

export function createMailManager(
  defaultMailer: string,
  configs: Record<string, MailDriverConfig>,
  options: MailManagerFactoryOptions = {},
): MailManager {
  const manager = new MailManager(defaultMailer, configs);
  const fromAddress = options.fromAddress ?? "hello@example.com";

  for (const provider of ["resend", "sendgrid", "postmark", "mailgun"] as const) {
    manager.registerDriver(
      provider,
      (cfg) =>
        new HttpMailAdapter({
          provider,
          apiKey: ((cfg as Record<string, unknown>).apiKey as string) ?? "",
          from: fromAddress,
        }),
    );
  }

  return manager;
}
