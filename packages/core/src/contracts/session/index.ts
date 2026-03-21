/**
 * @module @formwork/core/contracts/session
 * @description Session store contract - all session drivers implement this interface.
 *
 * Implementations: MemorySessionStore, FileSessionStore
 *
 * @example
 * ```ts
 * const store = container.make<ISessionStore>('session.store');
 * const data = await store.read('session-id-abc');
 * await store.write('session-id-abc', { user: { id: 1 } });
 * ```
 */

/** @typedef {Object} ISessionStore - Session store contract */
export interface ISessionStore {
  /**
   * Read session data by ID.
   * @param {string} id - Session identifier
   * @returns {Promise<Record<string, unknown> | null>} Session data or null if expired/missing
   */
  read(id: string): Promise<Record<string, unknown> | null>;

  /**
   * Write session data.
   * @param {string} id - Session identifier
   * @param {Record<string, unknown>} data - Session data to store
   * @returns {Promise<void>}
   */
  write(id: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Destroy a session.
   * @param {string} id - Session identifier
   * @returns {Promise<void>}
   */
  destroy(id: string): Promise<void>;

  /**
   * Regenerate the session ID (prevents session fixation attacks).
   * @param {string} oldId - Current session ID
   * @returns {Promise<string>} New session ID
   */
  regenerate(oldId: string): Promise<string>;

  /**
   * Garbage collect expired sessions.
   * @param {number} maxLifetimeSeconds - Maximum session age in seconds
   * @returns {Promise<number>} Number of sessions removed
   */
  gc(maxLifetimeSeconds: number): Promise<number>;
}
