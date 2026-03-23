/**
 * @module @carpentry/core/contracts/orm
 * @description ORM contracts - database adapter, query builder, model, and relation interfaces.
 *
 * Implementations: SQLiteMemoryAdapter, QueryBuilder, BaseModel, HasOne/HasMany/BelongsTo
 *
 * @example
 * ```ts
 * import { IDatabaseAdapter } from '@carpentry/core/contracts/orm';
 *
 * const db = container.make<IDatabaseAdapter>('db');
 * const rows = await db.raw('SELECT * FROM users WHERE active = ?', [true]);
 * ```
 */

export type CompiledQueryType =
  | "schema"
  | "insert"
  | "select"
  | "update"
  | "delete"
  | "raw"
  | "aggregate";

export interface CompiledQuery {
  sql: string;
  bindings: unknown[];
  type: CompiledQueryType | string;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  insertId?: number | string;
}

export interface IPaginator<T = Record<string, unknown>> {
  data: T[];
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  hasMorePages: boolean;
}

/** @typedef {Object} IDatabaseAdapter - Database driver contract */
export interface IDatabaseAdapter {
  /**
   * Identify the underlying driver.
   * @returns {string}
   */
  driverName(): string;

  /**
   * Establish a connection if the adapter requires one.
   * @returns {Promise<void>}
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the underlying driver.
   * @returns {Promise<void>}
   */
  disconnect(): Promise<void>;

  /**
   * Execute a compiled query and return structured results.
   * @param {CompiledQuery} query - Query object with SQL, bindings, and type metadata
   * @returns {Promise<QueryResult<T>>}
   * @example
   * ```ts
   * const users = await db.execute({
   *   sql: 'SELECT id, email FROM users WHERE role = ? AND active = ?',
   *   bindings: ['admin', true],
   *   type: 'select',
   * });
   * // Returns: { rows: [{ id: 1, email: 'admin@example.com' }], rowCount: 1 }
   * ```
   */
  execute<T = Record<string, unknown>>(query: CompiledQuery): Promise<QueryResult<T>>;

  /**
   * Execute raw SQL and normalize the result shape.
   * @param {string} sql - SQL query string with parameter placeholders
   * @param {unknown[]} [bindings] - Parameterized values
   * @returns {Promise<QueryResult<T>>}
   */
  raw<T = Record<string, unknown>>(sql: string, bindings?: unknown[]): Promise<QueryResult<T>>;

  /**
   * Execute a statement that modifies data (INSERT/UPDATE/DELETE).
   * @param {string} sql - SQL statement
   * @param {unknown[]} [params] - Parameterized values
   * @returns {Promise<{ affectedRows: number; insertId?: number }>}
   * @example
   * ```ts
   * const result = await db.run(
   *   'INSERT INTO users (name, email) VALUES (?, ?)',
   *   ['John Doe', 'john@example.com']
   * );
   * // Returns: { affectedRows: 1, insertId: 42 }
   * ```
   */
  run(sql: string, params?: unknown[]): Promise<{ affectedRows: number; insertId?: number }>;

  /**
   * Begin a database transaction.
   * @returns {Promise<void>}
   * @example
   * ```ts
   * await db.beginTransaction();
   * await db.run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [100, 1]);
   * await db.run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [100, 2]);
   * await db.commit();
   * ```
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit the current transaction.
   * @returns {Promise<void>}
   */
  commit(): Promise<void>;

  /**
   * Roll back the current transaction.
   * @returns {Promise<void>}
   * @example
   * ```ts
   * try {
   *   await db.beginTransaction();
   *   await db.run('DELETE FROM users WHERE id = ?', [999]);
   *   await db.commit();
   * } catch (error) {
   *   await db.rollback();
   * }
   * ```
   */
  rollback(): Promise<void>;

  /**
   * Close the database connection.
   * @returns {Promise<void>}
   */
  close(): Promise<void>;
}

/** @typedef {'=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'IN' | 'NOT IN' | 'BETWEEN' | 'IS' | 'IS NOT'} WhereOperator */
export type WhereOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "LIKE"
  | "IN"
  | "NOT IN"
  | "BETWEEN"
  | "IS"
  | "IS NOT";

/** @typedef {Object} IQueryBuilder - Fluent query builder contract */
export interface IQueryBuilder {
  /**
   * Add a SELECT clause.
   * @param {...string} columns - Column names to select
   * @returns {IQueryBuilder} Fluent interface
   * @example
   * ```ts
   * const result = await Post.query()
   *   .select('id', 'title', 'author_id')
   *   .get();
   * ```
   */
  select(...columns: string[]): IQueryBuilder;

  /**
   * Add a WHERE condition.
   * @param {string} column - Column name
   * @param {WhereOperator} operator - Comparison operator
   * @param {unknown} value - Value to compare against
   * @returns {IQueryBuilder} Fluent interface
   * @example
   * ```ts
   * const posts = await Post.query()
   *   .where('status', '=', 'published')
   *   .where('author_id', '=', 42)
   *   .where('created_at', '>', '2024-01-01')
   *   .get();
   * ```
   */
  where(column: string, operator: WhereOperator, value: unknown): IQueryBuilder;

  /**
   * Add an ORDER BY clause.
   * @param {string} column - Column to sort by
   * @param {'asc' | 'desc'} [direction='asc'] - Sort direction
   * @returns {IQueryBuilder}
   * @example
   * ```ts
   * const posts = await Post.query()
   *   .orderBy('created_at', 'desc')
   *   .orderBy('title', 'asc')
   *   .limit(10)
   *   .get();
   * ```
   */
  orderBy(column: string, direction?: "asc" | "desc"): IQueryBuilder;

  /**
   * Limit the number of results.
   * @param {number} count - Maximum rows to return
   * @returns {IQueryBuilder}
   * @example
   * ```ts
   * const firstTen = await User.query()
   *   .orderBy('id', 'asc')
   *   .limit(10)
   *   .get();
   * ```
   */
  limit(count: number): IQueryBuilder;

  /**
   * Skip a number of results.
   * @param {number} count - Number of rows to skip
   * @returns {IQueryBuilder}
   * @example
   * ```ts
   * const page2 = await Post.query()
   *   .limit(20)
   *   .offset(20)
   *   .get();
   * ```
   */
  offset(count: number): IQueryBuilder;

  /**
   * Execute the query and return all matching rows.
   * @returns {Promise<Record<string, unknown>[]>}
   * @example
   * ```ts
   * const allUsers = await User.query().get();
   * // Returns: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
   * ```
   */
  get(): Promise<Record<string, unknown>[]>;

  /**
   * Execute the query and return the first matching row.
   * @returns {Promise<Record<string, unknown> | null>}
   * @example
   * ```ts
   * const admin = await User.query()
   *   .where('role', '=', 'admin')
   *   .first();
   * // Returns: { id: 1, name: 'Admin User' } or null
   * ```
   */
  first(): Promise<Record<string, unknown> | null>;

  /**
   * Count matching rows.
   * @returns {Promise<number>}
   * @example
   * ```ts
   * const activeUserCount = await User.query()
   *   .where('active', '=', true)
   *   .count();
   * // Returns: 42
   * ```
   */
  count(): Promise<number>;
}

/** @typedef {'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany'} RelationType */
export type RelationType = "hasOne" | "hasMany" | "belongsTo" | "belongsToMany";
