/**
 * @module @carpentry/orm
 * @description Fluent QueryBuilder — produces AST consumed by database adapters, not raw SQL
 * @patterns Builder (fluent chaining), Visitor (AST traversal by adapters)
 * @principles SRP — builds queries only; DIP — depends on IDatabaseAdapter interface
 */

import type { IDatabaseAdapter, CompiledQuery, QueryResult, IPaginator } from '@carpentry/core/contracts';
import type { Dictionary } from '@carpentry/core/types';
import { compileQuery } from './sql-compiler.js';

// Re-export types so existing imports don't break
export type { WhereClause, OrderByClause, JoinClause, QueryAST, CompiledQuery as CompiledQueryResult } from './sql-compiler.js';
import type { QueryAST } from './sql-compiler.js';

/**
 * Fluent query builder that produces a query AST consumed by database adapters.
 *
 * Use {@link QueryBuilder} indirectly via {@link BaseModel.query()} or directly when
 * you need adapter-driven query compilation.
 *
 * @example
 * ```ts
 * import { QueryBuilder, MockDatabaseAdapter } from '@carpentry/orm';
 *
 * const adapter = new MockDatabaseAdapter().queueResult([{ id: 1 }], 1);
 * const qb = new QueryBuilder(adapter, 'users');
 *
 * const row = await qb.where('id', 1).first();
 * ```
 *
 * @see BaseModel — Convenience static query entry point
 */
export class QueryBuilder<T = Record<string, unknown>> {
  private ast: QueryAST;
  private adapter: IDatabaseAdapter;

  constructor(adapter: IDatabaseAdapter, table: string) {
    this.adapter = adapter;
    this.ast = {
      type: 'select', table, columns: ['*'],
      wheres: [], orders: [], joins: [], groupBys: [], havings: [],
      distinct: false,
    };
  }

  /**
   * @param {string[]} ...columns
   * @returns {this}
   */
  select(...columns: string[]): this {
    this.ast.columns = columns.length > 0 ? columns : ['*'];
    return this;
  }

  /**
   * Add a raw expression to the select columns.
   * @example qb.selectRaw('COUNT(comments.id) as comments_count')
   */
  selectRaw(expression: string): this {
    if (this.ast.columns.length === 1 && this.ast.columns[0] === '*') {
      this.ast.columns = [this.ast.table + '.*', expression];
    } else {
      this.ast.columns.push(expression);
    }
    return this;
  }

  /**
   * Add a subselect count for a related table.
   * Produces: SELECT *, (SELECT COUNT(*) FROM related WHERE related.fk = table.pk) as related_count
   *
   * @param relation - Name used for the count alias (e.g., 'comments' → comments_count)
   * @param relatedTable - The related table to count
   * @param foreignKey - The FK column in the related table
   * @param localKey - The local key column (default: 'id')
   *
   * @example
   * ```ts
   * qb.withCount('comments', 'comments', 'post_id')
   * // SELECT posts.*, (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) as comments_count
   * ```
   */
  withCount(relation: string, relatedTable: string, foreignKey: string, localKey = 'id'): this {
    const subselect = `(SELECT COUNT(*) FROM ${relatedTable} WHERE ${relatedTable}.${foreignKey} = ${this.ast.table}.${localKey}) as ${relation}_count`;
    return this.selectRaw(subselect);
  }

  distinct(): this { this.ast.distinct = true; return this; }

  /**
   * @param {string} column
   * @param {unknown} opOrVal
   * @param {unknown} [value]
   * @returns {this}
   */
  where(column: string, opOrVal: unknown, value?: unknown): this {
    if (value === undefined) {
      this.ast.wheres.push({ column, operator: '=', value: opOrVal, boolean: 'and' });
    } else {
      this.ast.wheres.push({ column, operator: opOrVal as string, value, boolean: 'and' });
    }
    return this;
  }

  /**
   * @param {string} column
   * @param {unknown} opOrVal
   * @param {unknown} [value]
   * @returns {this}
   */
  orWhere(column: string, opOrVal: unknown, value?: unknown): this {
    if (value === undefined) {
      this.ast.wheres.push({ column, operator: '=', value: opOrVal, boolean: 'or' });
    } else {
      this.ast.wheres.push({ column, operator: opOrVal as string, value, boolean: 'or' });
    }
    return this;
  }

  /**
   * @param {string} column
   * @param {unknown[]} values
   * @returns {this}
   */
  whereIn(column: string, values: unknown[]): this {
    this.ast.wheres.push({ column, operator: 'IN', value: values, boolean: 'and' });
    return this;
  }

  /**
   * @param {string} column
   * @returns {this}
   */
  whereNull(column: string): this {
    this.ast.wheres.push({ column, operator: 'IS NULL', value: null, boolean: 'and' });
    return this;
  }

  /**
   * @param {string} column
   * @returns {this}
   */
  whereNotNull(column: string): this {
    this.ast.wheres.push({ column, operator: 'IS NOT NULL', value: null, boolean: 'and' });
    return this;
  }

  /**
   * @param {string} column
   * @param {[unknown} range
   * @param {unknown} unknown]
   * @returns {this}
   */
  whereBetween(column: string, range: [unknown, unknown]): this {
    this.ast.wheres.push({ column, operator: 'BETWEEN', value: range, boolean: 'and' });
    return this;
  }

  /**
   * @param {string} table
   * @param {string} local
   * @param {string} op
   * @param {string} foreign
   * @returns {this}
   */
  join(table: string, local: string, op: string, foreign: string): this {
    this.ast.joins.push({ table, localKey: local, operator: op, foreignKey: foreign, type: 'inner' });
    return this;
  }

  /**
   * @param {string} table
   * @param {string} local
   * @param {string} op
   * @param {string} foreign
   * @returns {this}
   */
  leftJoin(table: string, local: string, op: string, foreign: string): this {
    this.ast.joins.push({ table, localKey: local, operator: op, foreignKey: foreign, type: 'left' });
    return this;
  }

  /**
   * @param {string} column
   * @param {'asc' | 'desc'} [direction]
   * @returns {this}
   */
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.ast.orders.push({ column, direction });
    return this;
  }

  /**
   * @param {string[]} ...columns
   * @returns {this}
   */
  groupBy(...columns: string[]): this { this.ast.groupBys.push(...columns); return this; }

  /**
   * @param {string} column
   * @param {string} operator
   * @param {unknown} value
   * @returns {this}
   */
  having(column: string, operator: string, value: unknown): this {
    this.ast.havings.push({ column, operator, value, boolean: 'and' });
    return this;
  }

  /**
   * @param {number} count
   * @returns {this}
   */
  limit(count: number): this { this.ast.limitCount = count; return this; }
  /**
   * @param {number} count
   * @returns {this}
   */
  offset(count: number): this { this.ast.offsetCount = count; return this; }

  // ── Terminal operations ─────────────────────────────────

  async get(): Promise<T[]> {
    this.ast.type = 'select';
    const compiled = this.compile(this.ast);
    const result = await this.adapter.execute<T>(compiled);
    return result.rows;
  }

  async first(): Promise<T | null> {
    this.ast.limitCount = 1;
    const rows = await this.get();
    return rows[0] ?? null;
  }

  async firstOrFail(): Promise<T> {
    const result = await this.first();
    if (!result) throw new Error(`No results found for query on "${this.ast.table}".`);
    return result;
  }

  /**
   * @param {string} [column]
   * @returns {Promise<number>}
   */
  async count(column: string = '*'): Promise<number> { return this.aggregate('COUNT', column); }
  /**
   * @param {string} column
   * @returns {Promise<number>}
   */
  async sum(column: string): Promise<number> { return this.aggregate('SUM', column); }
  /**
   * @param {string} column
   * @returns {Promise<number>}
   */
  async avg(column: string): Promise<number> { return this.aggregate('AVG', column); }
  /**
   * @param {string} column
   * @returns {Promise<number>}
   */
  async min(column: string): Promise<number> { return this.aggregate('MIN', column); }
  /**
   * @param {string} column
   * @returns {Promise<number>}
   */
  async max(column: string): Promise<number> { return this.aggregate('MAX', column); }

  /**
   * @param {number} [page]
   * @param {number} [perPage]
   * @returns {Promise<IPaginator<T>>}
   */
  async paginate(page: number = 1, perPage: number = 15): Promise<IPaginator<T>> {
    const countQb = this.clone();
    countQb.ast.orders = [];
    countQb.ast.limitCount = undefined;
    countQb.ast.offsetCount = undefined;
    const total = await countQb.count();

    this.ast.limitCount = perPage;
    this.ast.offsetCount = (page - 1) * perPage;
    const data = await this.get();
    const lastPage = Math.ceil(total / perPage);

    return { data, total, perPage, currentPage: page, lastPage, hasMorePages: page < lastPage };
  }

  /**
   * @param {number} size
   * @param {(rows: T[]} callback
   * @returns {Promise<void>}
   */
  async chunk(size: number, callback: (rows: T[]) => Promise<void> | void): Promise<void> {
    let page = 1;
    while (true) {
      const c = this.clone();
      c.ast.limitCount = size;
      c.ast.offsetCount = (page - 1) * size;
      const rows = await c.get();
      if (rows.length === 0) break;
      await callback(rows);
      if (rows.length < size) break;
      page++;
    }
  }

  /**
   * @param {Dictionary | Dictionary[]} data
   * @returns {Promise<QueryResult>}
   */
  async insert(data: Dictionary | Dictionary[]): Promise<QueryResult> {
    return this.adapter.execute(this.compile({ ...this.ast, type: 'insert', data }));
  }

  /**
   * @param {Dictionary} data
   * @returns {Promise<number>}
   */
  async update(data: Dictionary): Promise<number> {
    const r = await this.adapter.execute(this.compile({ ...this.ast, type: 'update', data }));
    return r.rowCount;
  }

  async delete(): Promise<number> {
    const r = await this.adapter.execute(this.compile({ ...this.ast, type: 'delete' }));
    return r.rowCount;
  }

  /** Expose AST for testing and adapter inspection */
  getAST(): Readonly<QueryAST> { return { ...this.ast }; }

  toCompiledQuery(): CompiledQuery { return this.compile(this.ast); }

  // ── Internal ────────────────────────────────────────────

  private async aggregate(fn: string, column: string): Promise<number> {
    const aggAst: QueryAST = {
      ...this.ast, type: 'aggregate',
      aggregateFunction: fn, aggregateColumn: column,
      columns: [`${fn}(${column}) as aggregate`],
      orders: [], limitCount: undefined, offsetCount: undefined,
    };
    const result = await this.adapter.execute<{ aggregate: number }>(this.compile(aggAst));
    return result.rows[0]?.aggregate ?? 0;
  }

  private compile(ast: QueryAST): CompiledQuery {
    return compileQuery(ast);
  }

  private clone(): QueryBuilder<T> {
    const qb = new QueryBuilder<T>(this.adapter, this.ast.table);
    qb.ast = JSON.parse(JSON.stringify(this.ast));
    return qb;
  }
}
