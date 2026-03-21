/**
 * @module @formwork/core/contracts/graphql
 * @description GraphQL contracts - schema, type definition, and resolver interfaces.
 *
 * Implementations: SchemaBuilder, DataLoader, PubSub
 *
 * @example
 * ```ts
 * const schema = new SchemaBuilder();
 * schema.type('User', { id: { type: 'ID' }, name: { type: 'String' } });
 * schema.query('user', { type: 'User', resolve: (_, args) => User.find(args.id) });
 * ```
 */

/** @typedef {Object} TypeDefinition - A GraphQL type definition */
export interface TypeDefinition {
  /** @property {string} name - Type name (e.g., 'User', 'Post') */
  name: string;
  /** @property {Record<string, FieldDefinition>} fields - Type fields */
  fields: Record<string, FieldDefinition>;
  /** @property {string} [description] - Type description */
  description?: string;
}

/** @typedef {Object} FieldDefinition - A field within a GraphQL type */
export interface FieldDefinition {
  /** @property {string} type - GraphQL type string (e.g., 'String', 'ID', '[Post]') */
  type: string;
  /** @property {boolean} [nullable] - Whether the field can be null */
  nullable?: boolean;
  /** @property {Record<string, {type: string}>} [args] - Field arguments */
  args?: Record<string, { type: string }>;
  /** @property {Function} [resolve] - Field resolver function */
  resolve?: (parent: unknown, args: Record<string, unknown>) => unknown;
  /** @property {string} [description] - Field description */
  description?: string;
}

/** @typedef {Object} IDataLoader - Batching loader for N+1 prevention */
export interface IDataLoader<K, V> {
  /**
   * Load a single item by key (batched automatically).
   * @param {K} key - Item key
   * @returns {Promise<V>} Loaded item
   */
  load(key: K): Promise<V>;

  /**
   * Load multiple items by keys.
   * @param {K[]} keys - Item keys
   * @returns {Promise<V[]>} Loaded items (same order as keys)
   */
  loadMany(keys: K[]): Promise<V[]>;

  /**
   * Clear the cache for a key.
   * @param {K} key - Key to clear
   * @returns {void}
   */
  clear(key: K): void;
}
