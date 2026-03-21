/**
 * @module @formwork/log
 * @description Built-in log channel implementations
 * @patterns Strategy (each channel is a strategy)
 * @principles OCP (add channels without modifying Logger), LSP (all substitute ILogChannel)
 */

import { LOG_LEVEL_SEVERITY } from './types.js';
import type { LogEntry, ILogChannel, LogLevel } from './types.js';

// ── ConsoleChannel — colored console output ───────────────

/**
 * ConsoleChannel — writes log entries to Node's console.
 *
 * Useful for development; respects `minLevel` to filter lower-severity messages.
 *
 * @example
 * ```ts
 * import { Logger, ConsoleChannel } from '@formwork/log';
 *
 * const logger = new Logger(new ConsoleChannel('info'), { app: 'carpenter' });
 * logger.error('Something failed', { route: '/login' });
 * ```
 */
export class ConsoleChannel implements ILogChannel {
  readonly name = 'console';
  readonly minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'debug') {
    this.minLevel = minLevel;
  }

  /**
   * @param {LogEntry} entry
   */
  write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const ts = entry.timestamp.toISOString();
    const ctx = Object.keys(entry.context).length > 0
      ? ` ${JSON.stringify(entry.context)}`
      : '';

    const line = `[${ts}] ${entry.level.toUpperCase()}: ${entry.message}${ctx}`;

    switch (entry.level) {
      case 'emergency': case 'alert': case 'critical': case 'error':
        console.error(line); break;
      case 'warning':
        console.warn(line); break;
      case 'debug':
        console.debug(line); break;
      default:
        console.log(line);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_SEVERITY[level] <= LOG_LEVEL_SEVERITY[this.minLevel];
  }
}

// ── ArrayChannel — stores entries for testing ─────────────

/**
 * ArrayChannel — stores log entries in memory for assertions.
 *
 * This channel is commonly used in unit tests:
 * - inspect logs via `all()`, `count()`, `forLevel()`
 * - assert expectations via `assertLogged*()` helpers
 */
export class ArrayChannel implements ILogChannel {
  readonly name: string;
  readonly minLevel: LogLevel;
  private entries: LogEntry[] = [];

  constructor(name: string = 'array', minLevel: LogLevel = 'debug') {
    this.name = name;
    this.minLevel = minLevel;
  }

  /**
   * @param {LogEntry} entry
   */
  write(entry: LogEntry): void {
    if (LOG_LEVEL_SEVERITY[entry.level] > LOG_LEVEL_SEVERITY[this.minLevel]) return;
    this.entries.push({ ...entry });
  }

  // ── Test Assertions ───────────────────────────────────

  all(): LogEntry[] { return [...this.entries]; }
  count(): number { return this.entries.length; }

  /**
   * @param {LogLevel} level
   * @returns {LogEntry[]}
   */
  forLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter((e) => e.level === level);
  }

  /**
   * @param {LogLevel} level
   * @param {string} [messageFragment]
   */
  assertLogged(level: LogLevel, messageFragment?: string): void {
    const matches = messageFragment
      ? this.entries.filter((e) => e.level === level && e.message.includes(messageFragment))
      : this.entries.filter((e) => e.level === level);

    if (matches.length === 0) {
      const msg = messageFragment ? ` containing "${messageFragment}"` : '';
      throw new Error(`Expected a ${level} log${msg}, but none found.`);
    }
  }

  /**
   * @param {LogLevel} level
   * @param {string} [messageFragment]
   */
  assertNotLogged(level: LogLevel, messageFragment?: string): void {
    const matches = messageFragment
      ? this.entries.filter((e) => e.level === level && e.message.includes(messageFragment))
      : this.entries.filter((e) => e.level === level);

    if (matches.length > 0) {
      throw new Error(`Expected NO ${level} log${messageFragment ? ` containing "${messageFragment}"` : ''}, but ${matches.length} found.`);
    }
  }

  /**
   * @param {number} n
   */
  assertCount(n: number): void {
    if (this.entries.length !== n) throw new Error(`Expected ${n} log entries, got ${this.entries.length}.`);
  }

  assertNothingLogged(): void {
    if (this.entries.length > 0) throw new Error(`Expected no logs, but ${this.entries.length} found.`);
  }

  /**
   * @param {LogLevel} level
   * @param {string} key
   * @param {unknown} [value]
   */
  assertLoggedWithContext(level: LogLevel, key: string, value?: unknown): void {
    const matches = this.entries.filter((e) => {
      if (e.level !== level) return false;
      if (!(key in e.context)) return false;
      if (value !== undefined && e.context[key] !== value) return false;
      return true;
    });
    if (matches.length === 0) {
      throw new Error(`Expected ${level} log with context key "${key}"${value !== undefined ? `=${JSON.stringify(value)}` : ''}, but none found.`);
    }
  }

  reset(): void { this.entries = []; }
}

// ── JsonChannel — JSON-structured output (for log aggregators) ──

/**
 * JsonChannel — emits log entries as JSON lines.
 *
 * Useful when you want machine-readable output (e.g., log aggregation).
 */
export class JsonChannel implements ILogChannel {
  readonly name = 'json';
  readonly minLevel: LogLevel;
  private output: string[] = [];

  constructor(minLevel: LogLevel = 'debug') {
    this.minLevel = minLevel;
  }

  /**
   * @param {LogEntry} entry
   */
  write(entry: LogEntry): void {
    if (LOG_LEVEL_SEVERITY[entry.level] > LOG_LEVEL_SEVERITY[this.minLevel]) return;

    const line = JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      severity: LOG_LEVEL_SEVERITY[entry.level],
      message: entry.message,
      ...entry.context,
      channel: entry.channel,
    });
    this.output.push(line);
  }

  getOutput(): string[] { return [...this.output]; }
  reset(): void { this.output = []; }
}

// ── NullChannel — discards everything ─────────────────────

/**
 * NullChannel — discards all log entries.
 *
 * Useful for silencing logs in tests or benchmarks.
 */
export class NullChannel implements ILogChannel {
  readonly name = 'null';
  readonly minLevel: LogLevel = 'debug';
  write(): void { /* discard */ }
}

// ── StackChannel — fan-out to multiple channels ───────────

/**
 * StackChannel — forwards each log entry to multiple channels.
 *
 * This is handy when you want to write to both console and JSON output, etc.
 */
export class StackChannel implements ILogChannel {
  readonly name = 'stack';
  readonly minLevel: LogLevel = 'debug';
  private channels: ILogChannel[];

  constructor(channels: ILogChannel[]) {
    this.channels = channels;
  }

  /**
   * @param {LogEntry} entry
   */
  write(entry: LogEntry): void {
    for (const channel of this.channels) {
      channel.write(entry);
    }
  }

  getChannels(): ILogChannel[] { return [...this.channels]; }
}
