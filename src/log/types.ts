/**
 * @module @carpentry/log
 * @description Log types, levels, and channel interfaces
 * @principles ISP (small interfaces)
 */

/**
 * @module @carpentry/log
 * @description Structured logging — application logs, audit logs, multiple channels
 *
 * Three concerns, one package:
 *   1. Application Logs — info/warn/error with structured context (Console, File, JSON channels)
 *   2. Audit Logs — who did what, when, to what resource, from where (compliance/security)
 *   3. Log Channels — pluggable transports: Console, Array (testing), JSON, Stack (fan-out), Database
 *
 * @patterns Strategy (channels), Chain of Responsibility (stack channel), Observer (log events),
 *           Builder (LogEntry), Null Object (NullChannel)
 * @principles OCP — new channels (Sentry, Datadog, Elasticsearch, CloudWatch) without modifying core
 *             SRP — each channel handles one transport; LogManager routes
 *             DIP — app depends on Logger interface, never on console.log or fs directly
 */

// ── Log Levels (RFC 5424 / PSR-3) ────────────────────────

export type LogLevel =
  | "emergency"
  | "alert"
  | "critical"
  | "error"
  | "warning"
  | "notice"
  | "info"
  | "debug";

export const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

// ── Log Entry ─────────────────────────────────────────────

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: Record<string, unknown>;
  timestamp: Date;
  channel?: string;
}

// ── Log Channel Interface ─────────────────────────────────

export interface ILogChannel {
  readonly name: string;
  /** Minimum level this channel processes (entries below this severity are ignored) */
  readonly minLevel: LogLevel;
  /** Write a log entry */
  /**
   * @param {LogEntry} entry
   * @returns {Promise<void> | void}
   */
  write(entry: LogEntry): Promise<void> | void;
}
