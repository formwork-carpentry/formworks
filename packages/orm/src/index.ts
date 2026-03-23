/**
 * @module @carpentry/orm
 * @description ORM — QueryBuilder, BaseModel, migrations, seeders, relations, and helpers.
 *
 * Use this package to:
 * - Model database records with {@link BaseModel} (Active Record pattern)
 * - Build queries fluently with {@link QueryBuilder} (AST compiled by adapters)
 * - Define schema changes with migrations ({@link Schema}, {@link Blueprint})
 * - Seed data with factories ({@link ModelFactory}, {@link BaseSeeder})
 *
 * @example
 * ```ts
 * import { BaseModel, MockDatabaseAdapter } from '@carpentry/orm';
 *
 * class User extends BaseModel {
 *   static table = 'users';
 *   static fillable = ['name'];
 * }
 *
 * // Tests/adapters often provide a mock adapter.
 * const db = new MockDatabaseAdapter().queueResult([{ id: 1, name: 'Alice' }], 1);
 * BaseModel.adapter = db;
 *
 * const user = await User.find(1);
 * // user?.attributes.name === 'Alice'
 * ```
 *
 * @see BaseModel — Active Record model API
 * @see QueryBuilder — Fluent query builder
 * @see Schema — Migration schema builder
 */

export { QueryBuilder } from './query/QueryBuilder.js';
export type { QueryAST, WhereClause, OrderByClause, JoinClause } from './query/QueryBuilder.js';
export { BaseModel, ModelQueryBuilder } from './model/BaseModel.js';
export type { ModelEvent, ModelEventHandler, CastType } from './model/BaseModel.js';
export { Schema, Blueprint, ColumnBuilder, MigrationRunner } from './migrations/Migration.js';
export type { ColumnDefinition, ForeignKeyDefinition, ColumnType, MigrationClass } from './migrations/Migration.js';
export { ModelFactory, defineFactory, BaseSeeder } from './seeders/Factory.js';
export { BaseRelation, HasOne, HasMany, BelongsTo, BelongsToMany, eagerLoad, getRelation } from './relations/Relations.js';
export { MockDatabaseAdapter } from './adapters/MockDatabaseAdapter.js';
