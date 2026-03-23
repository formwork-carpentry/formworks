/**
 * @module @carpentry/log
 * @description LogManager — channel registration and Logger factory
 * @patterns Factory Method (creates Loggers), Strategy (selects channels)
 */

import type { ILogChannel } from './types.js';
import { Logger } from './Logger.js';
import { ConsoleChannel, NullChannel, ArrayChannel } from './channels.js';

// ── LogManager — resolves loggers by channel name ─────────

/**
 * Central log factory for creating {@link Logger} instances per channel.
 *
 * Register custom channels via {@link addChannel}, then resolve a logger with {@link channel}.
 * For app-wide access, bind an instance once using `setLogManager()` so the global {@link Log}
 * facade can be used.
 *
 * @example
 * ```ts
 * import { LogManager, ArrayChannel, setLogManager, Log } from '@carpentry/log';
 *
 * const channel = new ArrayChannel('test');
 * const manager = new LogManager('test').addChannel(channel);
 * setLogManager(manager);
 *
 * Log.error('Something went wrong', { route: '/login' });
 * ```
 *
 * @see Log — Global facade
 * @see ArrayChannel — In-memory channel for tests
 */
export class LogManager {
  private channels = new Map<string, ILogChannel>();
  private defaultChannel: string;

  constructor(defaultChannel: string = 'console') {
    this.defaultChannel = defaultChannel;
    this.addChannel(new ConsoleChannel());
    this.addChannel(new NullChannel());
  }

  /**
   * @param {ILogChannel} channel
   * @returns {this}
   */
  addChannel(channel: ILogChannel): this {
    this.channels.set(channel.name, channel);
    return this;
  }

  /** Get a Logger for a named channel */
  /**
   * @param {string} [name]
   * @returns {Logger}
   */
  channel(name?: string): Logger {
    const channelName = name ?? this.defaultChannel;
    const ch = this.channels.get(channelName);
    if (!ch) throw new Error(`Log channel "${channelName}" not registered. Available: ${[...this.channels.keys()].join(', ')}`);
    return new Logger(ch);
  }

  /** Convenience — log via the default channel */
  /**
   * @param {string} msg
   * @param {Object} [ctx]
   */
  emergency(msg: string, ctx?: Record<string, unknown>): void { this.channel().emergency(msg, ctx); }
  /**
   * @param {string} msg
   * @param {Object} [ctx]
   */
  alert(msg: string, ctx?: Record<string, unknown>): void { this.channel().alert(msg, ctx); }
  /**
   * @param {string} msg
   * @param {Object} [ctx]
   */
  critical(msg: string, ctx?: Record<string, unknown>): void { this.channel().critical(msg, ctx); }
  /**
   * @param {string} msg
   * @param {Object} [ctx]
   */
  error(msg: string, ctx?: Record<string, unknown>): void { this.channel().error(msg, ctx); }
  /**
   * @param {string} msg
   * @param {Object} [ctx]
   */
  warning(msg: string, ctx?: Record<string, unknown>): void { this.channel().warning(msg, ctx); }
  /**
   * @param {string} msg
   * @param {Object} [ctx]
   */
  notice(msg: string, ctx?: Record<string, unknown>): void { this.channel().notice(msg, ctx); }
  /**
   * @param {string} msg
   * @param {Object} [ctx]
   */
  info(msg: string, ctx?: Record<string, unknown>): void { this.channel().info(msg, ctx); }
  /**
   * @param {string} msg
   * @param {Object} [ctx]
   */
  debug(msg: string, ctx?: Record<string, unknown>): void { this.channel().debug(msg, ctx); }

  /** Replace the default channel with an ArrayChannel for testing */
  /**
   * @param {string} [channelName]
   * @returns {ArrayChannel}
   */
  fake(channelName?: string): ArrayChannel {
    const fake = new ArrayChannel(channelName ?? this.defaultChannel);
    this.channels.set(fake.name, fake);
    return fake;
  }
}
