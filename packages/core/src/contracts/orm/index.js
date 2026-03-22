/**
 * @module @formwork/core/contracts/orm
 * @description ORM contracts - database adapter, query builder, model, and relation interfaces.
 *
 * Implementations: SQLiteMemoryAdapter, QueryBuilder, BaseModel, HasOne/HasMany/BelongsTo
 *
 * @example
 * ```ts
 * import { IDatabaseAdapter } from '@formwork/core/contracts/orm';
 *
 * const db = container.make<IDatabaseAdapter>('db');
 * const rows = await db.raw('SELECT * FROM users WHERE active = ?', [true]);
 * ```
 */
export {};
//# sourceMappingURL=index.js.map