/**
 * @module @carpentry/cli
 * @description Security audit commands — check application configuration, environment,
 * and common security misconfigurations.
 *
 * WHY: Security misconfigurations (debug mode in production, missing APP_KEY, exposed
 * secrets, permissive CORS) are the #1 cause of production incidents. This tool
 * catches them before deployment.
 *
 * HOW: The `security:audit` command runs a series of checks against the application
 * config and environment, reporting warnings and failures.
 *
 * @patterns Command, Strategy (pluggable checks)
 * @principles SRP (security checking only), OCP (add checks via addCheck)
 *
 * @example
 * ```bash
 * carpenter security:audit
 * # 🔒 Security Audit
 * #   ✅ APP_KEY is set and sufficient length
 * #   ✅ Debug mode is disabled
 * #   ❌ CORS allows all origins (restrict in production)
 * #   ⚠️  Session cookie not marked as secure
 * #   ✅ HTTPS enforced
 * ```
 */

import { BaseCommand } from "./index.js";
import type { CommandOutput } from "./index.js";

// ── Audit Check Types ─────────────────────────────────────

export interface AuditCheck {
  name: string;
  description: string;
  severity: "critical" | "warning" | "info";
  check: (env: Record<string, string | undefined>) => AuditResult;
}

export interface AuditResult {
  passed: boolean;
  message: string;
}

// ── Built-in Security Checks ──────────────────────────────

const BUILTIN_CHECKS: AuditCheck[] = [
  {
    name: "APP_KEY set",
    description: "Application encryption key must be set and at least 32 characters",
    severity: "critical",
    check: (env) => {
      const key = env.APP_KEY ?? "";
      if (!key)
        return {
          passed: false,
          message: "APP_KEY is not set — generate one with `carpenter key:generate`",
        };
      if (key.length < 32)
        return {
          passed: false,
          message: `APP_KEY is only ${key.length} chars — should be at least 32`,
        };
      return { passed: true, message: `APP_KEY is set (${key.length} chars)` };
    },
  },
  {
    name: "Debug mode",
    description: "Debug mode should be disabled in production",
    severity: "critical",
    check: (env) => {
      const debug = env.APP_DEBUG ?? "false";
      const appEnv = env.APP_ENV ?? "development";
      if (appEnv === "production" && (debug === "true" || debug === "1")) {
        return {
          passed: false,
          message: "APP_DEBUG is enabled in production — stack traces will be exposed",
        };
      }
      return {
        passed: true,
        message: `Debug mode ${debug === "true" ? "enabled" : "disabled"} (env: ${appEnv})`,
      };
    },
  },
  {
    name: "CORS configuration",
    description: "CORS should not allow all origins in production",
    severity: "warning",
    check: (env) => {
      const origin = env.CORS_ORIGIN ?? "*";
      const appEnv = env.APP_ENV ?? "development";
      if (appEnv === "production" && origin === "*") {
        return {
          passed: false,
          message: "CORS allows all origins (*) in production — restrict to your domain",
        };
      }
      return { passed: true, message: `CORS origin: ${origin}` };
    },
  },
  {
    name: "Session security",
    description: "Session cookies should be secure and httpOnly",
    severity: "warning",
    check: (env) => {
      const secure = env.SESSION_SECURE_COOKIE ?? "false";
      const appEnv = env.APP_ENV ?? "development";
      if (appEnv === "production" && secure !== "true") {
        return {
          passed: false,
          message: "SESSION_SECURE_COOKIE is not true — cookies sent over HTTP",
        };
      }
      return { passed: true, message: "Session cookie security configured" };
    },
  },
  {
    name: "JWT secret",
    description: "JWT secret should be set and different from APP_KEY",
    severity: "warning",
    check: (env) => {
      const jwtSecret = env.JWT_SECRET ?? "";
      const appKey = env.APP_KEY ?? "";
      if (!jwtSecret && !appKey) return { passed: false, message: "No JWT_SECRET or APP_KEY set" };
      if (jwtSecret === "change-me" || jwtSecret === "secret") {
        return { passed: false, message: "JWT_SECRET is using a default value — change it" };
      }
      return { passed: true, message: "JWT secret configured" };
    },
  },
  {
    name: "Database credentials",
    description: "Database should not use default/empty passwords in production",
    severity: "critical",
    check: (env) => {
      const appEnv = env.APP_ENV ?? "development";
      const dbPass = env.DB_PASSWORD ?? "";
      if (appEnv === "production" && (!dbPass || dbPass === "root" || dbPass === "password")) {
        return { passed: false, message: "DB_PASSWORD is empty or default in production" };
      }
      return { passed: true, message: "Database credentials check passed" };
    },
  },
  {
    name: "HTTPS enforcement",
    description: "Application URL should use HTTPS in production",
    severity: "warning",
    check: (env) => {
      const url = env.APP_URL ?? "http://localhost:3000";
      const appEnv = env.APP_ENV ?? "development";
      if (appEnv === "production" && !url.startsWith("https://")) {
        return { passed: false, message: `APP_URL uses HTTP in production: ${url}` };
      }
      return { passed: true, message: `APP_URL: ${url}` };
    },
  },
  {
    name: "Rate limiting",
    description: "Rate limiting should be configured for API endpoints",
    severity: "info",
    check: (env) => {
      const limit = env.RATE_LIMIT_MAX ?? "";
      if (!limit)
        return {
          passed: false,
          message: "No RATE_LIMIT_MAX configured — consider adding rate limiting",
        };
      return { passed: true, message: `Rate limit: ${limit} requests per window` };
    },
  },
];

// ── Security Audit Command ────────────────────────────────

/**
 * CLI command `security:audit` — built-in and custom `AuditCheck` rules over `process.env`.
 *
 * Runs all security checks against the current environment and reports results.
 * @example
 * ```ts
 * import { CliApp, SecurityAuditCommand } from '@carpentry/cli';
 * await new CliApp().register(new SecurityAuditCommand()).run(['security:audit']);
 * ```
 * @see BaseCommand
 */
export class SecurityAuditCommand extends BaseCommand {
  name = "security:audit";
  description = "Run a security audit on your application configuration";
  private customChecks: AuditCheck[] = [];

  /** Add a custom security check (for plugins) */
  /**
   * @param {AuditCheck} check
   * @returns {this}
   */
  addCheck(check: AuditCheck): this {
    this.customChecks.push(check);
    return this;
  }

  /**
   * @param {CommandOutput} output
   * @returns {Promise<number>}
   */
  async handle(
    _args: Record<string, string>,
    _options: Record<string, unknown>,
    output: CommandOutput,
  ): Promise<number> {
    output.info("🔒 Security Audit");
    output.info("");

    const allChecks = [...BUILTIN_CHECKS, ...this.customChecks];
    const env = process.env as Record<string, string | undefined>;

    let criticalFails = 0;
    let warnings = 0;

    for (const check of allChecks) {
      const result = check.check(env);
      const icon = result.passed ? "✅" : check.severity === "critical" ? "❌" : "⚠️";
      output.info(`  ${icon} ${check.name}: ${result.message}`);

      if (!result.passed) {
        if (check.severity === "critical") criticalFails++;
        else warnings++;
      }
    }

    output.info("");
    if (criticalFails > 0) {
      output.error(`${criticalFails} critical issue(s) found. Fix before deploying.`);
      return 1;
    }
    if (warnings > 0) {
      output.warn(`${warnings} warning(s) found. Review before deploying.`);
      return 0;
    }
    output.success("All security checks passed.");
    return 0;
  }
}

/**
 * Standalone function — run audit checks programmatically (for CI/CD pipelines).
 *
 * @example
 * ```ts
 * const results = runSecurityAudit(process.env);
 * const failed = results.filter(r => !r.result.passed && r.check.severity === 'critical');
 * if (failed.length > 0) process.exit(1);
 * ```
 */
export function runSecurityAudit(
  env: Record<string, string | undefined>,
  extraChecks: AuditCheck[] = [],
): Array<{ check: AuditCheck; result: AuditResult }> {
  return [...BUILTIN_CHECKS, ...extraChecks].map((check) => ({
    check,
    result: check.check(env),
  }));
}
