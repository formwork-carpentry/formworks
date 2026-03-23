/**
 * @module @carpentry/core
 * @description Default configuration template — all standard sections driven by environment variables
 * @principles Convention over configuration — sensible defaults, override via .env
 */

import type { Dictionary } from "../types/index.js";
import { env } from "./Config.js";

/**
 * Build the default Carpenter configuration.
 * Every value reads from process.env with a sensible fallback.
 * Call loadEnv() BEFORE this function to populate process.env from .env files.
 *
 * @example
 * ```ts
 * import { loadEnv } from '@carpentry/core';
 * import { buildDefaultConfig } from '@carpentry/core';
 *
 * await loadEnv(); // reads .env, .env.local
 * const config = new Config(buildDefaultConfig());
 * ```
 *
 * @returns {Dictionary} Complete default configuration object
 */
export function buildDefaultConfig(): Dictionary {
  return {
    app: {
      name: env("APP_NAME", "Carpenter"),
      env: env("APP_ENV", "development"),
      debug: env<boolean>("APP_DEBUG", true),
      key: env("APP_KEY", ""),
      url: env("APP_URL", "http://localhost:3000"),
      port: env<number>("PORT", 3000),
    },

    database: {
      default: env("DB_CONNECTION", "memory"),
      connections: {
        memory: {
          driver: "memory",
        },
        sqlite: {
          driver: "sqlite",
          database: env("DB_DATABASE", ":memory:"),
        },
        postgres: {
          driver: "postgres",
          host: env("DB_HOST", "127.0.0.1"),
          port: env<number>("DB_PORT", 5432),
          database: env("DB_DATABASE", "carpenter"),
          username: env("DB_USERNAME", "root"),
          password: env("DB_PASSWORD", ""),
          schema: env("DB_SCHEMA", "public"),
          ssl: env<boolean>("DB_SSL", false),
        },
        mysql: {
          driver: "mysql",
          host: env("DB_HOST", "127.0.0.1"),
          port: env<number>("DB_PORT", 3306),
          database: env("DB_DATABASE", "carpenter"),
          username: env("DB_USERNAME", "root"),
          password: env("DB_PASSWORD", ""),
          charset: "utf8mb4",
        },
      },
    },

    cache: {
      default: env("CACHE_DRIVER", "memory"),
      stores: {
        memory: { driver: "memory" },
        null: { driver: "null" },
        file: {
          driver: "file",
          path: env("CACHE_PATH", "storage/cache"),
        },
        redis: {
          driver: "redis",
          url: env("REDIS_URL", "redis://localhost:6379"),
          prefix: env("CACHE_PREFIX", "carpenter_cache:"),
        },
      },
    },

    queue: {
      default: env("QUEUE_CONNECTION", "sync"),
      connections: {
        sync: { driver: "sync" },
        memory: { driver: "memory" },
        database: {
          driver: "database",
          table: env("QUEUE_TABLE", "jobs"),
          retryAfter: env<number>("QUEUE_RETRY_AFTER", 90),
        },
        redis: {
          driver: "redis",
          url: env("REDIS_URL", "redis://localhost:6379"),
          queue: env("QUEUE_NAME", "default"),
        },
      },
    },

    mail: {
      default: env("MAIL_MAILER", "log"),
      mailers: {
        log: { driver: "log" },
        array: { driver: "array" },
        resend: {
          driver: "resend",
          apiKey: env("RESEND_API_KEY", ""),
        },
        sendgrid: {
          driver: "sendgrid",
          apiKey: env("SENDGRID_API_KEY", ""),
        },
        postmark: {
          driver: "postmark",
          apiKey: env("POSTMARK_API_KEY", ""),
        },
        mailgun: {
          driver: "mailgun",
          apiKey: env("MAILGUN_API_KEY", ""),
          domain: env("MAILGUN_DOMAIN", ""),
        },
      },
      from: {
        address: env("MAIL_FROM_ADDRESS", "noreply@example.com"),
        name: env("MAIL_FROM_NAME", "Carpenter"),
      },
    },

    storage: {
      default: env("FILESYSTEM_DISK", "local"),
      disks: {
        local: {
          driver: "local",
          root: env("STORAGE_PATH", "storage/app"),
          url: `${env("APP_URL", "http://localhost:3000")}/storage`,
        },
        memory: { driver: "memory" },
        public: {
          driver: "local",
          root: env("STORAGE_PUBLIC_PATH", "storage/app/public"),
          url: `${env("APP_URL", "http://localhost:3000")}/storage`,
        },
        s3: {
          driver: "s3",
          bucket: env("AWS_BUCKET", ""),
          region: env("AWS_DEFAULT_REGION", "us-east-1"),
          key: env("AWS_ACCESS_KEY_ID", ""),
          secret: env("AWS_SECRET_ACCESS_KEY", ""),
          url: env("AWS_URL", ""),
        },
      },
    },

    session: {
      driver: env("SESSION_DRIVER", "memory"),
      lifetime: env<number>("SESSION_LIFETIME", 120),
      path: env("SESSION_PATH", "storage/sessions"),
      cookie: env("SESSION_COOKIE", "carpenter_session"),
      secure: env<boolean>("SESSION_SECURE_COOKIE", false),
      httpOnly: true,
      sameSite: "lax",
    },

    logging: {
      default: env("LOG_CHANNEL", "console"),
      channels: {
        console: {
          driver: "console",
          level: env("LOG_LEVEL", "debug"),
        },
        json: {
          driver: "json",
          level: env("LOG_LEVEL", "info"),
        },
        null: { driver: "null" },
      },
    },

    auth: {
      defaults: {
        guard: env("AUTH_GUARD", "memory"),
      },
      guards: {
        memory: { driver: "memory", provider: "memory" },
        jwt: {
          driver: "jwt",
          secret: env("JWT_SECRET", env("APP_KEY", "change-me")),
          expiresIn: env<number>("JWT_TTL", 3600),
          issuer: env("APP_NAME", "Carpenter"),
        },
      },
    },

    hashing: {
      driver: env("HASH_DRIVER", "sha256"),
    },
  };
}
