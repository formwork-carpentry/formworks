/**
 * @module @carpentry/db-turso
 * @description Type definitions for the Turso/libSQL database adapter.
 */

/** Configuration for TursoDatabaseAdapter */
export interface TursoConfig {
  /** Turso database URL (e.g., libsql://my-db-org.turso.io) */
  url: string;
  /** Auth token for the Turso database */
  authToken?: string;
  /** Path for local embedded replica (enables offline reads) */
  syncUrl?: string;
  /** Sync interval in seconds for embedded replicas */
  syncInterval?: number;
}
