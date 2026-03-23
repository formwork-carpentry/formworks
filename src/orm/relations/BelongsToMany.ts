/**
 * @module @carpentry/orm
 * @description BelongsToMany relation — many-to-many via pivot table
 * @patterns Strategy (relation resolution)
 * @principles SRP (only many-to-many logic)
 */

import type { Dictionary } from '@carpentry/formworks/core/types';
import { QueryBuilder } from '../query/QueryBuilder.js';
import { BaseModel } from '../model/BaseModel.js';
import { BaseRelation } from './BaseRelation.js';
import type { ModelClass, RelationHolder } from './BaseRelation.js';

/**
 * BelongsToMany — many-to-many via a pivot table.
 *
 * Example: `User` ↔ `Role` through `role_user` with `user_id` and `role_id`.
 *
 * @example
 * ```ts
 * const rel = new BelongsToMany(Role, 'role_user', 'user_id', 'role_id');
 * const roles = await rel.resolve(user);
 * ```
 */
export class BelongsToMany<T extends BaseModel = BaseModel> extends BaseRelation<T> {
  constructor(
    relatedClass: ModelClass<T>,
    private pivotTable: string,
    private foreignPivotKey: string,
    private relatedPivotKey: string,
    private parentKey: string = 'id',
    private relatedKey: string = 'id',
  ) {
    super(relatedClass);
  }

  /**
   * @param {BaseModel} parent
   * @returns {QueryBuilder<Dictionary>}
   */
  getQuery(parent: BaseModel): QueryBuilder<Dictionary> {
    const relatedTable = this.relatedClass.table;
    return new QueryBuilder<Dictionary>(this.adapter, relatedTable)
      .join(this.pivotTable, `${relatedTable}.${this.relatedKey}`, '=', `${this.pivotTable}.${this.relatedPivotKey}`)
      .where(`${this.pivotTable}.${this.foreignPivotKey}`, parent.getAttribute(this.parentKey));
  }

  /**
   * @param {BaseModel} parent
   * @returns {Promise<T[]>}
   */
  async resolve(parent: BaseModel): Promise<T[]> {
    const rows = await this.getQuery(parent).get();
    return this.hydrateMany(rows);
  }

  /**
   * @param {BaseModel[]} parents
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(parents: BaseModel[], relationName: string): Promise<void> {
    const keys = parents.map((p) => p.getAttribute(this.parentKey)).filter(Boolean);
    if (keys.length === 0) return;

    const relatedTable = this.relatedClass.table;
    const rows = await new QueryBuilder<Dictionary>(this.adapter, relatedTable)
      .select(`${relatedTable}.*`, `${this.pivotTable}.${this.foreignPivotKey} as _pivot_fk`)
      .join(this.pivotTable, `${relatedTable}.${this.relatedKey}`, '=', `${this.pivotTable}.${this.relatedPivotKey}`)
      .whereIn(`${this.pivotTable}.${this.foreignPivotKey}`, keys)
      .get();

    const grouped = new Map<unknown, Dictionary[]>();
    for (const row of rows) {
      const fk = row['_pivot_fk'];
      if (!grouped.has(fk)) grouped.set(fk, []);
      grouped.get(fk)!.push(row);
    }

    for (const parent of parents) {
      const key = parent.getAttribute(this.parentKey);
      const related = grouped.get(key) ?? [];
      (parent as unknown as RelationHolder)[`_rel_${relationName}`] = this.hydrateMany(related);
    }
  }

  /** Attach related models via pivot table */
  /**
   * @param {BaseModel} parent
   * @param {(string | number} ids
   * @returns {Promise<void>}
   */
  async attach(parent: BaseModel, ids: (string | number)[], pivotData: Dictionary = {}): Promise<void> {
    const parentKey = parent.getAttribute(this.parentKey);
    const rows = ids.map((id) => ({
      [this.foreignPivotKey]: parentKey,
      [this.relatedPivotKey]: id,
      ...pivotData,
    }));
    await new QueryBuilder(this.adapter, this.pivotTable).insert(rows);
  }

  /** Detach related models from pivot table */
  /**
   * @param {BaseModel} parent
   * @param {(string | number} [ids]
   * @returns {Promise<void>}
   */
  async detach(parent: BaseModel, ids?: (string | number)[]): Promise<void> {
    const qb = new QueryBuilder(this.adapter, this.pivotTable)
      .where(this.foreignPivotKey, parent.getAttribute(this.parentKey));
    if (ids && ids.length > 0) qb.whereIn(this.relatedPivotKey, ids);
    await qb.delete();
  }

  /** Sync pivot table — attach missing, detach extra */
  /**
   * @param {BaseModel} parent
   * @param {(string | number} ids
   * @returns {Promise<void>}
   */
  async sync(parent: BaseModel, ids: (string | number)[]): Promise<void> {
    await this.detach(parent);
    if (ids.length > 0) await this.attach(parent, ids);
  }
}
