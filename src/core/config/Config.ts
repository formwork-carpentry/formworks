/**
 * @module @carpentry/core
 * @description Typed configuration with dot-notation access and environment variable overrides
 * @patterns Flyweight (cached after first load)
 * @principles SRP — only manages config values; DIP — no dependency on filesystem directly
 */

import type { Dictionary } from "../types/index.js";

export interface ConfigRepository {
  /**
   * @param {string} key
   * @param {T} [defaultValue]
   * @returns {T}
   */
  get<T = unknown>(key: string, defaultValue?: T): T;
  /**
   * @param {string} key
   * @param {unknown} value
   */
  set(key: string, value: unknown): void;
  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key: string): boolean;
  all(): Dictionary;
}

/**
 * In-memory `ConfigRepository` with dot-notation get/set/merge and deep merges for nested objects.
 * Usually registered as the `config` binding on `Application`.
 *
 * @example
 * ```ts
 * import { Config } from '..';
 *
 * const config = new Config({ app: { name: 'API' }, db: { host: 'localhost' } });
 * config.get<string>('app.name');
 * config.set('db.port', 5432);
 * ```
 *
 * @see ConfigRepository
 */
export class Config implements ConfigRepository {
  private items: Dictionary;

  constructor(items: Dictionary = {}) {
    this.items = items;
  }

  /**
   * Get a config value using dot-notation.
   *
   * @param key - Dot-notation path (e.g. 'database.connections.postgres.host')
   * @param defaultValue - Returned if key is not found
   * @returns The resolved value or defaultValue
   *
   * @example
   * ```typescript
   * config.get<string>('app.name', 'Carpenter')
   * config.get<number>('database.port', 5432)
   * ```
   */
  get<T = unknown>(key: string, defaultValue?: T): T {
    const value = this.dotGet(this.items, key);
    if (value === undefined) {
      return defaultValue as T;
    }
    return value as T;
  }

  /**
   * Set a config value using dot-notation.
   */
  set(key: string, value: unknown): void {
    this.dotSet(this.items, key, value);
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key: string): boolean {
    return this.dotGet(this.items, key) !== undefined;
  }

  all(): Dictionary {
    return { ...this.items };
  }

  /**
   * Merge additional config into the repository.
   */
  merge(items: Dictionary): void {
    this.items = this.deepMerge(this.items, items);
  }

  // ── Dot-notation helpers ────────────────────────────────

  private dotGet(obj: Dictionary, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Dictionary)[part];
    }

    return current;
  }

  private dotSet(obj: Dictionary, path: string, value: unknown): void {
    const parts = path.split(".");
    let current: Dictionary = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Dictionary;
    }

    current[parts[parts.length - 1]] = value;
  }

  private deepMerge(target: Dictionary, source: Dictionary): Dictionary {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = result[key];
      if (
        typeof sourceVal === "object" &&
        sourceVal !== null &&
        !Array.isArray(sourceVal) &&
        typeof targetVal === "object" &&
        targetVal !== null &&
        !Array.isArray(targetVal)
      ) {
        result[key] = this.deepMerge(targetVal as Dictionary, sourceVal as Dictionary);
      } else {
        result[key] = sourceVal;
      }
    }
    return result;
  }
}

/**
 * Environment variable reader with typed coercion.
 *
 * @example
 * ```typescript
 * env<number>('PORT', 3000)
 * env<boolean>('DEBUG', false)
 * env<string>('APP_KEY')
 * ```
 */
export function env<T extends string | number | boolean = string>(
  key: string,
  defaultValue?: T,
): T {
  const raw = process.env[key];

  /**
   * @param {unknown} [raw === undefined]
   */
  if (raw === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    return undefined as unknown as T;
  }

  // Type coercion based on default value type
  /**
   * @param {unknown} [typeof defaultValue === 'number']
   */
  if (typeof defaultValue === "number") {
    return Number(raw) as T;
  }
  /**
   * @param {unknown} [typeof defaultValue === 'boolean']
   */
  if (typeof defaultValue === "boolean") {
    return (raw === "true" || raw === "1") as unknown as T;
  }

  return raw as T;
}
