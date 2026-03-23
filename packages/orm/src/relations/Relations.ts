/**
 * @module @carpentry/orm
 * @description ORM Relations — HasOne, HasMany, BelongsTo
 * @patterns Strategy (relation types), Proxy (lazy loading), Builder (eager loading query)
 * @principles OCP — new relation types without modifying BaseModel
 *             SRP — each relation class handles one relationship type
 *             DIP — relations use QueryBuilder, not raw SQL
 */

import type { Dictionary } from '@carpentry/core/types';
import { QueryBuilder } from '../query/QueryBuilder.js';
import { BaseModel } from '../model/BaseModel.js';
import { BaseRelation } from './BaseRelation.js';
import type { ModelClass, RelationHolder } from './BaseRelation.js';

// Re-export so existing imports still work
export { BaseRelation } from './BaseRelation.js';
export type { ModelClass, RelationHolder } from './BaseRelation.js';
export { BelongsToMany } from './BelongsToMany.js';

// ── HasOne ────────────────────────────────────────────────

/**
 * HasOne — parent has a single related row; related table holds the foreign key.
 *
 * Example: `User` has one `Profile` where `profiles.user_id` points to `users.id`.
 *
 * @example
 * ```ts
 * const rel = new HasOne(Profile, 'user_id', 'id');
 * const profile = await rel.resolve(user);
 * ```
 */
export class HasOne<T extends BaseModel = BaseModel> extends BaseRelation<T> {
  constructor(
    relatedClass: ModelClass<T>,
    private foreignKey: string,
    private localKey: string = 'id',
  ) {
    super(relatedClass);
  }

  /**
   * @param {BaseModel} parent
   * @returns {QueryBuilder<Dictionary>}
   */
  getQuery(parent: BaseModel): QueryBuilder<Dictionary> {
    return new QueryBuilder<Dictionary>(this.adapter, this.relatedClass.table)
      .where(this.foreignKey, parent.getAttribute(this.localKey));
  }

  /**
   * @param {BaseModel} parent
   * @returns {Promise<T | null>}
   */
  async resolve(parent: BaseModel): Promise<T | null> {
    const row = await this.getQuery(parent).first();
    return row ? this.hydrate(row) : null;
  }

  /**
   * @param {BaseModel[]} parents
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(parents: BaseModel[], relationName: string): Promise<void> {
    const keys = parents.map((p) => p.getAttribute(this.localKey)).filter(Boolean);
    if (keys.length === 0) return;

    const rows = await new QueryBuilder<Dictionary>(this.adapter, this.relatedClass.table)
      .whereIn(this.foreignKey, keys)
      .get();

    const map = new Map<unknown, Dictionary>();
    for (const row of rows) {
      map.set(row[this.foreignKey], row);
    }

    for (const parent of parents) {
      const key = parent.getAttribute(this.localKey);
      const row = map.get(key);
      (parent as unknown as RelationHolder)[`_rel_${relationName}`] = row ? this.hydrate(row) : null;
    }
  }
}

// ── HasMany ───────────────────────────────────────────────

/**
 * User hasMany Posts — Post has user_id column.
 */
export class HasMany<T extends BaseModel = BaseModel> extends BaseRelation<T> {
  constructor(
    relatedClass: ModelClass<T>,
    private foreignKey: string,
    private localKey: string = 'id',
  ) {
    super(relatedClass);
  }

  /**
   * @param {BaseModel} parent
   * @returns {QueryBuilder<Dictionary>}
   */
  getQuery(parent: BaseModel): QueryBuilder<Dictionary> {
    return new QueryBuilder<Dictionary>(this.adapter, this.relatedClass.table)
      .where(this.foreignKey, parent.getAttribute(this.localKey));
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
    const keys = parents.map((p) => p.getAttribute(this.localKey)).filter(Boolean);
    if (keys.length === 0) return;

    const rows = await new QueryBuilder<Dictionary>(this.adapter, this.relatedClass.table)
      .whereIn(this.foreignKey, keys)
      .get();

    const grouped = new Map<unknown, Dictionary[]>();
    for (const row of rows) {
      const fk = row[this.foreignKey];
      if (!grouped.has(fk)) grouped.set(fk, []);
      grouped.get(fk)!.push(row);
    }

    for (const parent of parents) {
      const key = parent.getAttribute(this.localKey);
      const related = grouped.get(key) ?? [];
      (parent as unknown as RelationHolder)[`_rel_${relationName}`] = this.hydrateMany(related);
    }
  }
}

// ── BelongsTo ─────────────────────────────────────────────

/**
 * BelongsTo — child row references parent; child table holds the foreign key.
 *
 * Example: `Post` belongs to `User` via `posts.user_id` → `users.id`.
 *
 * @example
 * ```ts
 * const rel = new BelongsTo(User, 'user_id', 'id');
 * const author = await rel.resolve(post);
 * ```
 */
export class BelongsTo<T extends BaseModel = BaseModel> extends BaseRelation<T> {
  constructor(
    relatedClass: ModelClass<T>,
    private foreignKey: string,
    private ownerKey: string = 'id',
  ) {
    super(relatedClass);
  }

  /**
   * @param {BaseModel} parent
   * @returns {QueryBuilder<Dictionary>}
   */
  getQuery(parent: BaseModel): QueryBuilder<Dictionary> {
    return new QueryBuilder<Dictionary>(this.adapter, this.relatedClass.table)
      .where(this.ownerKey, parent.getAttribute(this.foreignKey));
  }

  /**
   * @param {BaseModel} parent
   * @returns {Promise<T | null>}
   */
  async resolve(parent: BaseModel): Promise<T | null> {
    const fkValue = parent.getAttribute(this.foreignKey);
    if (fkValue === null || fkValue === undefined) return null;

    const row = await this.getQuery(parent).first();
    return row ? this.hydrate(row) : null;
  }

  /**
   * @param {BaseModel[]} parents
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(parents: BaseModel[], relationName: string): Promise<void> {
    const keys = parents
      .map((p) => p.getAttribute(this.foreignKey))
      .filter((k) => k !== null && k !== undefined);
    if (keys.length === 0) return;

    const uniqueKeys = [...new Set(keys)];
    const rows = await new QueryBuilder<Dictionary>(this.adapter, this.relatedClass.table)
      .whereIn(this.ownerKey, uniqueKeys)
      .get();

    const map = new Map<unknown, Dictionary>();
    for (const row of rows) {
      map.set(row[this.ownerKey], row);
    }

    for (const parent of parents) {
      const fk = parent.getAttribute(this.foreignKey);
      const row = map.get(fk);
      (parent as unknown as RelationHolder)[`_rel_${relationName}`] = row ? this.hydrate(row) : null;
    }
  }
}

// ── Eager Loading Helper ──────────────────────────────────

/**
 * Eager-loads relations for a set of models.
 * Prevents N+1 by batching related queries.
 */
export async function eagerLoad<T extends BaseModel>(
  models: T[],
  _modelClass: ModelClass<T>,
  relations: Record<string, () => BaseRelation>,
): Promise<void> {
  /**
   * @param {unknown} const [name
   * @param {unknown} factory] of Object.entries(relations
   */
  for (const [name, factory] of Object.entries(relations)) {
    const relation = factory();
    await relation.eagerLoad(models, name);
  }
}

/** Get an eager-loaded relation from a model */
/**
 * @param {BaseModel} model
 * @param {string} name
 * @returns {R}
 */
export function getRelation<R>(model: BaseModel, name: string): R {
  /**
   * @param {unknown} model as unknown as RelationHolder
   */
  return (model as unknown as RelationHolder)[`_rel_${name}`] as R;
}



