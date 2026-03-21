/**
 * @module @formwork/orm
 * @description Blueprint — defines table columns and constraints
 * @patterns Builder
 */

import { ColumnBuilder } from './column-types.js';
import type { ColumnDefinition, ColumnType, IndexDefinition } from './column-types.js';

/**
 * Blueprint — fluent column/constraint definition for one table in a migration.
 *
 * Passed to `Schema.create()` callback; accumulates {@link ColumnDefinition} rows then compiles to SQL.
 *
 * @example
 * ```ts
 * await schema.create('comments', (table) => {
 *   table.id();
 *   table.text('body');
 *   table.foreignId('post_id').constrained('posts');
 * });
 * ```
 */
export class Blueprint {
  public tableName: string;
  public columns: ColumnDefinition[] = [];
  public indexes: IndexDefinition[] = [];
  public operation: 'create' | 'alter' | 'drop' = 'create';

  constructor(table: string) {
    this.tableName = table;
  }

  // ── Column Types ────────────────────────────────────────

  /**
   * @param {string} [name]
   * @returns {ColumnBuilder}
   */
  id(name: string = 'id'): ColumnBuilder {
    return this.addColumn(name, 'id', { primaryKey: true, autoIncrement: true });
  }

  /**
   * @param {string} [name]
   * @returns {ColumnBuilder}
   */
  uuid(name: string = 'id'): ColumnBuilder {
    return this.addColumn(name, 'uuid', { primaryKey: true });
  }

  /**
   * @param {string} name
   * @param {number} [length]
   * @returns {ColumnBuilder}
   */
  string(name: string, length: number = 255): ColumnBuilder {
    return this.addColumn(name, 'string', { length });
  }

  /**
   * @param {string} name
   * @param {string[]} values
   * @returns {ColumnBuilder}
   */
  enum(name: string, values: string[]): ColumnBuilder {
    return this.addColumn(name, 'enum', { enumValues: [...values] });
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  text(name: string): ColumnBuilder {
    return this.addColumn(name, 'text');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  integer(name: string): ColumnBuilder {
    return this.addColumn(name, 'integer');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  bigInteger(name: string): ColumnBuilder {
    return this.addColumn(name, 'bigInteger');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  float(name: string): ColumnBuilder {
    return this.addColumn(name, 'float');
  }

  /**
   * @param {string} name
   * @param {number} [precision]
   * @param {number} [scale]
   * @returns {ColumnBuilder}
   */
  decimal(name: string, precision: number = 8, scale: number = 2): ColumnBuilder {
    return this.addColumn(name, 'decimal', { precision, scale });
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  boolean(name: string): ColumnBuilder {
    return this.addColumn(name, 'boolean');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  date(name: string): ColumnBuilder {
    return this.addColumn(name, 'date');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  datetime(name: string): ColumnBuilder {
    return this.addColumn(name, 'datetime');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  timestamp(name: string): ColumnBuilder {
    return this.addColumn(name, 'timestamp');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  json(name: string): ColumnBuilder {
    return this.addColumn(name, 'json');
  }

  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  binary(name: string): ColumnBuilder {
    return this.addColumn(name, 'binary');
  }

  /** Foreign key column: creates bigInteger + constraint */
  /**
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  foreignId(name: string): ColumnBuilder {
    return this.addColumn(name, 'bigInteger', { unsigned: true });
  }

  /**
   * Attach a foreign key definition to an existing column.
   *
   * If the column has not already been defined, this creates an unsigned
   * `bigInteger` column so the foreign-key chain remains usable.
   *
   * @param {string} name
   * @returns {ColumnBuilder}
   */
  foreign(name: string): ColumnBuilder {
    const existing = this.columns.find((column) => column.name === name);
    if (existing) {
      return new ColumnBuilder(existing);
    }

    return this.addColumn(name, 'bigInteger', { unsigned: true });
  }

  /**
   * Define a table-level index.
   *
   * @param {string[]} columns
   * @param {string} [name]
   */
  index(columns: string[], name?: string): void {
    this.indexes.push({
      columns: [...columns],
      name: name ?? `${this.tableName}_${columns.join('_')}_index`,
    });
  }

  // ── Shorthand Helpers ───────────────────────────────────

  /** Add created_at + updated_at timestamp columns */
  timestamps(): void {
    this.timestamp('created_at').nullable();
    this.timestamp('updated_at').nullable();
  }

  /** Add created_by + updated_by userstamp columns (foreign key to users table) */
  /**
   * @param {string} [createdBy]
   * @param {string} [updatedBy]
   */
  userstamps(createdBy: string = 'created_by', updatedBy: string = 'updated_by'): void {
    this.bigInteger(createdBy).nullable();
    this.bigInteger(updatedBy).nullable();
  }

  /** Add deleted_at for soft deletes */
  /**
   * @param {string} [column]
   */
  softDeletes(column: string = 'deleted_at'): void {
    this.timestamp(column).nullable();
  }

  // ── Internal ────────────────────────────────────────────

  private addColumn(name: string, type: ColumnType, overrides: Partial<ColumnDefinition> = {}): ColumnBuilder {
    const col: ColumnDefinition = {
      name,
      type,
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      index: false,
      unsigned: false,
      ...overrides,
    };
    this.columns.push(col);
    return new ColumnBuilder(col);
  }
}

// ── Schema Facade ─────────────────────────────────────────
