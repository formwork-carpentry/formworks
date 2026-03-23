/**
 * @module @carpentry/cache-memcached
 * @description Type definitions for the Memcached cache adapter.
 */

/** Configuration for MemcachedCacheStore */
export interface MemcachedConfig {
  /** Memcached server(s) as "host:port" (default: "localhost:11211") */
  servers?: string;
  /** SASL username for authentication */
  username?: string;
  /** SASL password for authentication */
  password?: string;
  /** Default TTL in seconds (default: 3600) */
  defaultTtl?: number;
  /** Key prefix to namespace entries */
  prefix?: string;
}
