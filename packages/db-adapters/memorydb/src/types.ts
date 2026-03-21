

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

export type CompiledQueryType = 'schema' | 'insert' | 'select' | 'update' | 'delete' | 'raw';


/**
 * Represents a compiled database query with its SQL statement, parameter bindings, and query type.
 * 
 * @interface CompiledQuery
 * @property {string} sql - The compiled SQL query string
 * @property {unknown[]} bindings - Array of parameter bindings for the SQL query
 * @property {CompiledQueryType} type - The type of query (schema, insert, select, update, delete, or raw)
 * 
 * @example
 * const query: CompiledQuery = {
 *   sql: 'SELECT * FROM users WHERE id = ?',
 *   bindings: [1],
 *   type: 'select'
 * };
 */

export interface CompiledQuery {
  sql: string;
  bindings: unknown[];
  type: CompiledQueryType;
}




/**
 * Represents the result of a database query execution.
 * 
 * @template T - The shape of each row returned by the query. Defaults to a generic record object.
 * 
 * @example
 * ```typescript
 * // Example: Query result from a SELECT statement
 * const result: QueryResult<{ id: number; name: string }> = {
 *   rows: [
 *     { id: 1, name: 'John' },
 *     { id: 2, name: 'Jane' }
 *   ],
 *   rowCount: 2
 * };
 * ```
 * 
 * @example
 * ```typescript
 * // Example: Query result from an INSERT statement
 * const insertResult: QueryResult = {
 *   rows: [],
 *   rowCount: 1,
 *   insertId: 42
 * };
 * ```
 * 
 * @property {T[]} rows - Array of row objects returned by the query. Type T defines the structure of each row.
 * @property {number} rowCount - The number of rows affected by the query operation.
 * @property {number} [insertId] - Optional auto-generated ID from an INSERT operation. Only present for insert queries.
 */
export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  insertId?: number;
}
