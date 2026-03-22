/**
 * Represents the type of a compiled database query.
 *
 * @typedef {('schema' | 'insert' | 'select' | 'update' | 'delete' | 'raw')} CompiledQueryType
 *
 * @property {'schema'} schema - Query for schema operations and definitions
 * @property {'insert'} insert - Query for inserting new records
 * @property {'select'} select - Query for retrieving records
 * @property {'update'} update - Query for updating existing records
 * @property {'delete'} delete - Query for deleting records
 * @property {'raw'} raw - Raw or custom query execution
 *
 * @example
 * const selectQuery: CompiledQuery = {
 *   sql: 'SELECT * FROM users WHERE id = ?',
 *   bindings: [1],
 *   type: 'select'
 * };
 *
 * const insertQuery: CompiledQuery = {
 *   sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
 *   bindings: ['John', 'john@example.com'],
 *   type: 'insert'
 * };
 */
export {};
//# sourceMappingURL=types.js.map