/**
 * @module @carpentry/orm
 * @description ModelQueryBuilder — wraps QueryBuilder to return hydrated model instances
 * @patterns Proxy (delegates to QueryBuilder)
 */

import type { Dictionary } from '@carpentry/formworks/core/types';
import type { QueryBuilder } from '../query/QueryBuilder.js';
import type { BaseModel } from './BaseModel.js';

type ModelStatic<T extends BaseModel = BaseModel> = (typeof BaseModel) & (new (attrs?: Dictionary) => T);

/**
 * ModelQueryBuilder — wraps {@link QueryBuilder} and returns hydrated model instances.
 *
 * Returned from `YourModel.query()`; delegates `where`, `orderBy`, etc. to the inner builder
 * and maps rows with {@link BaseModel.hydrate}.
 *
 * @example
 * ```ts
 * class Post extends BaseModel {
 *   static table = 'posts';
 * }
 * BaseModel.adapter = mockAdapter;
 * const posts = await Post.query().where('published', true).get();
 * ```
 *
 * @see BaseModel.query
 * @see QueryBuilder
 */
export class ModelQueryBuilder<T extends BaseModel> {
  constructor(
    private qb: QueryBuilder<Dictionary>,
    private modelClass: ModelStatic<T>,
  ) {}

  /**
   * @param {string} column
   * @param {unknown} opOrVal
   * @param {unknown} [value]
   * @returns {this}
   */
  where(column: string, opOrVal: unknown, value?: unknown): this {
    this.qb.where(column, opOrVal, value);
    return this;
  }

  /**
   * @param {string} column
   * @param {unknown} opOrVal
   * @param {unknown} [value]
   * @returns {this}
   */
  orWhere(column: string, opOrVal: unknown, value?: unknown): this {
    this.qb.orWhere(column, opOrVal, value);
    return this;
  }

  /**
   * @param {string} column
   * @param {'asc' | 'desc'} [dir]
   * @returns {this}
   */
  orderBy(column: string, dir: 'asc' | 'desc' = 'asc'): this {
    this.qb.orderBy(column, dir);
    return this;
  }

  /**
   * @param {number} n
   * @returns {this}
   */
  limit(n: number): this { this.qb.limit(n); return this; }

  /** Get the underlying AST for testing */
  getAST() { return this.qb.getAST(); }

  async get(): Promise<T[]> {
    const rows = await this.qb.get();
    return rows.map((row) => this.modelClass.hydrate(row));
  }

  async first(): Promise<T | null> {
    const row = await this.qb.first();
    return row ? this.modelClass.hydrate(row) : null;
  }

  async count(): Promise<number> {
    return this.qb.count();
  }
}
