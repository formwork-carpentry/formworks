/**
 * @module @carpentry/core
 * @description ConfigServiceProvider — the bridge between Config and infrastructure managers.
 * Reads config values and wires DatabaseManager, CacheManager, QueueManager, MailManager, StorageManager.
 * @patterns Abstract Factory (config-driven adapter creation), Mediator (connects config to managers)
 * @principles DIP (managers depend on interfaces, config drives selection), OCP (add drivers via register)
 */

import type { Config } from "./Config.js";

/**
 * Standard config structure for a Carpenter application.
 * Each section maps to a manager + driver factories.
 *
 * @example
 * ```ts
 * // config/app.ts
 * export default {
 *   app: {
 *     name: env('APP_NAME', 'Carpenter'),
 *     env: env('APP_ENV', 'development'),
 *     debug: env<boolean>('APP_DEBUG', false),
 *     key: env('APP_KEY', ''),
 *     url: env('APP_URL', 'http://localhost:3000'),
 *   },
 *
 *   database: {
 *     default: env('DB_CONNECTION', 'sqlite'),
 *     connections: {
 *       sqlite: {
 *         driver: 'sqlite',
 *         database: env('DB_DATABASE', ':memory:'),
 *       },
 *       postgres: {
 *         driver: 'postgres',
 *         host: env('DB_HOST', '127.0.0.1'),
 *         port: env<number>('DB_PORT', 5432),
 *         database: env('DB_DATABASE', 'carpenter'),
 *         username: env('DB_USERNAME', 'root'),
 *         password: env('DB_PASSWORD', ''),
 *       },
 *       mysql: {
 *         driver: 'mysql',
 *         host: env('DB_HOST', '127.0.0.1'),
 *         port: env<number>('DB_PORT', 3306),
 *         database: env('DB_DATABASE', 'carpenter'),
 *         username: env('DB_USERNAME', 'root'),
 *         password: env('DB_PASSWORD', ''),
 *       },
 *     },
 *   },
 *
 *   cache: {
 *     default: env('CACHE_DRIVER', 'memory'),
 *     stores: {
 *       memory: { driver: 'memory' },
 *       file: { driver: 'file', path: env('CACHE_PATH', 'storage/cache') },
 *       redis: { driver: 'redis', url: env('REDIS_URL', 'redis://localhost:6379') },
 *     },
 *   },
 *
 *   queue: {
 *     default: env('QUEUE_CONNECTION', 'sync'),
 *     connections: {
 *       sync: { driver: 'sync' },
 *       database: { driver: 'database', table: 'jobs' },
 *       redis: { driver: 'redis', url: env('REDIS_URL', 'redis://localhost:6379') },
 *     },
 *   },
 *
 *   mail: {
 *     default: env('MAIL_MAILER', 'log'),
 *     mailers: {
 *       log: { driver: 'log' },
 *       array: { driver: 'array' },
 *       resend: { driver: 'resend', apiKey: env('RESEND_API_KEY', '') },
 *       sendgrid: { driver: 'sendgrid', apiKey: env('SENDGRID_API_KEY', '') },
 *       smtp: { driver: 'smtp', host: env('MAIL_HOST', ''), port: env<number>('MAIL_PORT', 587) },
 *     },
 *     from: { address: env('MAIL_FROM_ADDRESS', 'noreply@example.com'), name: env('MAIL_FROM_NAME', 'Carpenter') },
 *   },
 *
 *   storage: {
 *     default: env('FILESYSTEM_DISK', 'local'),
 *     disks: {
 *       local: { driver: 'local', root: env('STORAGE_PATH', 'storage/app') },
 *       memory: { driver: 'memory' },
 *       s3: {
 *         driver: 's3',
 *         bucket: env('AWS_BUCKET', ''),
 *         region: env('AWS_DEFAULT_REGION', 'us-east-1'),
 *         key: env('AWS_ACCESS_KEY_ID', ''),
 *         secret: env('AWS_SECRET_ACCESS_KEY', ''),
 *       },
 *     },
 *   },
 *
 *   session: {
 *     driver: env('SESSION_DRIVER', 'memory'),
 *     lifetime: env<number>('SESSION_LIFETIME', 120),
 *     path: env('SESSION_PATH', 'storage/sessions'),
 *   },
 *
 *   logging: {
 *     default: env('LOG_CHANNEL', 'console'),
 *     channels: {
 *       console: { driver: 'console', level: env('LOG_LEVEL', 'debug') },
 *       file: { driver: 'json', path: env('LOG_PATH', 'storage/logs/app.log') },
 *       null: { driver: 'null' },
 *     },
 *   },
 * };
 * ```
 */

/**
 * Reads standard config sections and returns the resolved values
 * that managers need. This is the central "config → manager" bridge.
 *
 * @example
 * ```ts
 * import { Config, ConfigResolver } from '..';
 *
 * const resolver = new ConfigResolver(new Config({ database: { default: 'sqlite', connections: { sqlite: {} } } }));
 * resolver.dbConnection();
 * resolver.cacheDriver();
 * ```
 *
 * @see Config
 */
export class ConfigResolver {
  constructor(private readonly config: Config) {}

  // ── Database ────────────────────────────────────────────

  /** Get the default database connection name */
  dbConnection(): string {
    return this.config.get<string>("database.default", "memory");
  }

  /** Get all database connection configs */
  dbConnections(): Record<string, Record<string, unknown>> {
    return this.config.get("database.connections", {});
  }

  /** Get a specific database connection config */
  /**
   * @param {string} [name]
   * @returns {Record<string, unknown>}
   */
  dbConnectionConfig(name?: string): Record<string, unknown> {
    const connName = name ?? this.dbConnection();
    return this.config.get(`database.connections.${connName}`, {});
  }

  // ── Cache ───────────────────────────────────────────────

  cacheDriver(): string {
    return this.config.get<string>("cache.default", "memory");
  }

  cacheStores(): Record<string, Record<string, unknown>> {
    return this.config.get("cache.stores", {});
  }

  // ── Queue ───────────────────────────────────────────────

  queueConnection(): string {
    return this.config.get<string>("queue.default", "sync");
  }

  queueConnections(): Record<string, Record<string, unknown>> {
    return this.config.get("queue.connections", {});
  }

  // ── Mail ────────────────────────────────────────────────

  mailMailer(): string {
    return this.config.get<string>("mail.default", "log");
  }

  mailMailers(): Record<string, Record<string, unknown>> {
    return this.config.get("mail.mailers", {});
  }

  mailFrom(): { address: string; name: string } {
    return {
      address: this.config.get<string>("mail.from.address", "noreply@example.com"),
      name: this.config.get<string>("mail.from.name", "Carpenter"),
    };
  }

  // ── Storage ─────────────────────────────────────────────

  storageDisk(): string {
    return this.config.get<string>("storage.default", "local");
  }

  storageDisks(): Record<string, Record<string, unknown>> {
    return this.config.get("storage.disks", {});
  }

  // ── Bridge ──────────────────────────────────────────────

  bridgeTransport(): string {
    return this.config.get<string>("bridge.default", "memory");
  }

  bridgeTransports(): Record<string, Record<string, unknown>> {
    return this.config.get("bridge.transports", {});
  }

  // ── Session ─────────────────────────────────────────────

  sessionDriver(): string {
    return this.config.get<string>("session.driver", "memory");
  }

  sessionLifetime(): number {
    return this.config.get<number>("session.lifetime", 120);
  }

  // ── Logging ─────────────────────────────────────────────

  logChannel(): string {
    return this.config.get<string>("logging.default", "console");
  }

  logChannels(): Record<string, Record<string, unknown>> {
    return this.config.get("logging.channels", {});
  }

  // ── App ─────────────────────────────────────────────────

  appName(): string {
    return this.config.get<string>("app.name", "Carpenter");
  }

  appEnv(): string {
    return this.config.get<string>("app.env", "development");
  }

  isDebug(): boolean {
    return this.config.get<boolean>("app.debug", false);
  }

  isProduction(): boolean {
    return this.appEnv() === "production";
  }

  isDevelopment(): boolean {
    return this.appEnv() === "development";
  }

  isTesting(): boolean {
    return this.appEnv() === "testing";
  }
}
