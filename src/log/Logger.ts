/**
 * @module @carpentry/log
 * @description Logger — main application logger with level filtering and context
 * @patterns Facade (simplified logging API), Strategy (channel selection)
 * @principles SRP (only logging), DIP (depends on ILogChannel interface)
 */

import type { LogLevel, LogEntry, ILogChannel } from './types.js';

// ── Logger — the main application logger ──────────────────

/**
 * Application logger that writes structured log entries to an {@link ILogChannel}.
 *
 * Use `LogManager`/`Log` facades for app-wide access, or create a `Logger` directly.
 *
 * @example
 * ```ts
 * import { Logger, ArrayChannel } from './';
 *
 * const logger = new Logger(new ArrayChannel('test'), { app: 'carpenter' });
 * logger.withContext({ requestId: 'abc' }).info('Request started');
 * ```
 *
 * @see {@link ILogChannel} — Where logs are written
 * @see {@link LogManager} — Factory + channel registry
 */
export class Logger {
  private channel: ILogChannel;
  private defaultContext: Record<string, unknown>;

  constructor(channel: ILogChannel, defaultContext: Record<string, unknown> = {}) {
    this.channel = channel;
    this.defaultContext = defaultContext;
  }

  /**
   * @param {string} message
   * @param {Object} [context]
   */
  emergency(message: string, context: Record<string, unknown> = {}): void { this.log('emergency', message, context); }
  /**
   * @param {string} message
   * @param {Object} [context]
   */
  alert(message: string, context: Record<string, unknown> = {}): void { this.log('alert', message, context); }
  /**
   * @param {string} message
   * @param {Object} [context]
   */
  critical(message: string, context: Record<string, unknown> = {}): void { this.log('critical', message, context); }
  /**
   * @param {string} message
   * @param {Object} [context]
   */
  error(message: string, context: Record<string, unknown> = {}): void { this.log('error', message, context); }
  /**
   * @param {string} message
   * @param {Object} [context]
   */
  warning(message: string, context: Record<string, unknown> = {}): void { this.log('warning', message, context); }
  /**
   * @param {string} message
   * @param {Object} [context]
   */
  notice(message: string, context: Record<string, unknown> = {}): void { this.log('notice', message, context); }
  /**
   * @param {string} message
   * @param {Object} [context]
   */
  info(message: string, context: Record<string, unknown> = {}): void { this.log('info', message, context); }
  /**
   * @param {string} message
   * @param {Object} [context]
   */
  debug(message: string, context: Record<string, unknown> = {}): void { this.log('debug', message, context); }

  /** Log with explicit level */
  /**
   * @param {LogLevel} level
   * @param {string} message
   * @param {Object} [context]
   */
  log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      level,
      message,
      context: { ...this.defaultContext, ...context },
      timestamp: new Date(),
      channel: this.channel.name,
    };
    this.channel.write(entry);
  }

  /** Create a child logger with additional default context */
  /**
   * @param {Object} context
   * @returns {Logger}
   */
  withContext(context: Record<string, unknown>): Logger {
    return new Logger(this.channel, { ...this.defaultContext, ...context });
  }

  /** Get the underlying channel */
  getChannel(): ILogChannel { return this.channel; }
}
