/**
 * @module @carpentry/orm
 * @description BaseRelation — abstract base for all relation types
 * @patterns Template Method
 */

import type { IDatabaseAdapter } from '@carpentry/formworks/core/contracts';
import type { Dictionary } from '@carpentry/formworks/core/types';
import type { QueryBuilder } from '../query/QueryBuilder.js';
import { BaseModel } from '../model/BaseModel.js';

export type ModelClass<T extends BaseModel = BaseModel> = (typeof BaseModel) & (new (attrs?: Dictionary) => T);

export interface RelationHolder {
  [key: `_rel_${string}`]: unknown;
}

/**
 * BaseRelation — abstract base for all Eloquent-style relations.
 *
 * Subclasses implement `resolve` (lazy load), `eagerLoad` (batch for N+1 prevention),
 * and `getQuery` (scoped {@link QueryBuilder}).
 *
 * @example
 * ```ts
 * // Use concrete relation classes: HasOne, HasMany, BelongsTo, BelongsToMany.
 * // Each implements resolve(), eagerLoad(), and getQuery().
 * ```
 */
export abstract class BaseRelation<T extends BaseModel = BaseModel> {
  protected relatedClass: ModelClass<T>;
  protected adapter: IDatabaseAdapter;

  /**
   * @param {ModelClass<T>} relatedClass - The related model class
   */
  constructor(relatedClass: ModelClass<T>) {
    this.relatedClass = relatedClass;
    this.adapter = relatedClass.adapter;
  }

  /**
   * Resolve the relation for a parent model.
   * @param {BaseModel} parent - The parent model instance
   * @returns {Promise<T | T[] | null>} Related model(s)
   */
  abstract resolve(parent: BaseModel): Promise<T | T[] | null>;

  /**
   * Eager-load the relation for multiple parent models (prevents N+1).
   * @param {BaseModel[]} parents - Parent model instances
   * @param {string} relationName - Name of the relation
   * @returns {Promise<void>}
   */
  abstract eagerLoad(parents: BaseModel[], relationName: string): Promise<void>;

  /**
   * Get the query builder scoped to this relation.
   * @param {BaseModel} parent - The parent model instance
   * @returns {QueryBuilder<Dictionary>}
   */
  abstract getQuery(parent: BaseModel): QueryBuilder<Dictionary>;

  protected hydrate(row: Dictionary): T {
    return this.relatedClass.hydrate(row) as T;
  }

  protected hydrateMany(rows: Dictionary[]): T[] {
    return rows.map((row) => this.hydrate(row));
  }
}
