/**
 * @module @carpentry/log
 * @description Structured logging and audit trail.
 *
 * Use this package to:
 * - Write structured logs with level methods (`Log.error()`, `Log.info()`, etc.)
 * - Attach default context and create child loggers (`logger.withContext()`)
 * - Record audit events with the global `Audit` facade
 *
 * @example
 * ```ts
 * import { LogManager, ArrayChannel, setLogManager, Log } from '@carpentry/log';
 *
 * const channel = new ArrayChannel('test');
 * const manager = new LogManager('test').addChannel(channel);
 * setLogManager(manager);
 *
 * Log.info('User signed in', { userId: 42 });
 * ```
 *
 * For testing, you can use `ArrayChannel` and/or the `fake()` helpers on managers.
 */

export * from './types.js';
export * from './channels.js';
export * from './Logger.js';
export * from './LogManager.js';
export * from './audit.js';
export * from './facades.js';
