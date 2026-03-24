/**
 * @module @carpentry/orm
 * @description Column types, definitions, and builder
 * @patterns Builder (ColumnBuilder)
 */

/**
 * @module @carpentry/orm
 * @description Migration system — Schema builder, Blueprint, MigrationRunner
 * @patterns Template Method (BaseMigration up/down), Builder (Blueprint)
 * @principles SRP — schema management only; DIP — compiles via IDatabaseAdapter
 */



// ── Column Definition ─────────────────────────────────────

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  nullable: boolean;
  defaultValue?: unknown;
  primaryKey: boolean;
  autoIncrement: boolean;
  unique: boolean;
  index: boolean;
  unsigned: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  enumValues?: string[];
  references?: ForeignKeyDefinition;
}

export interface ForeignKeyDefinition {
  table: string;
  column: string;
  onDelete?: 'cascade' | 'restrict' | 'set null' | 'no action';
  onUpdate?: 'cascade' | 'restrict' | 'set null' | 'no action';
}

export interface IndexDefinition {
  columns: string[];
  name: string;
}

export type ColumnType =
  | 'id' | 'uuid' | 'string' | 'text' | 'integer' | 'bigInteger'
  | 'float' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'timestamp'
  | 'json' | 'binary' | 'enum';

// ── Column Builder (fluent modifiers) ─────────────────────

/**
 * ColumnBuilder — fluent modifiers for a single column (`nullable()`, `default()`, `index()`, etc.).
 *
 * Returned from {@link Blueprint} methods like `string('name')`.
 *
 * @example
 * ```ts
 * table.string('email').unique().nullable();
 * table.foreignId('user_id').constrained();
 * ```
 */
export class ColumnBuilder {
  constructor(private col: ColumnDefinition) {}

  nullable(): this { this.col.nullable = true; return this; }
  /**
   * @param {unknown} value
   * @returns {this}
   */
  default(value: unknown): this { this.col.defaultValue = value; return this; }
  unique(): this { this.col.unique = true; return this; }
  index(): this { this.col.index = true; return this; }
  unsigned(): this { this.col.unsigned = true; return this; }
  primary(): this { this.col.primaryKey = true; return this; }

  /**
   * Mark this column as referencing a target column.
   *
   * Useful for Laravel-style chains such as:
   * `table.integer('user_id').references('id').on('users')`
   *
   * @param {string} column
   * @returns {this}
   */
  references(column: string): this {
    const current = this.col.references;
    const next: ForeignKeyDefinition = {
      table: current?.table ?? '',
      column,
    };
    if (current?.onDelete !== undefined) {
      next.onDelete = current.onDelete;
    }
    if (current?.onUpdate !== undefined) {
      next.onUpdate = current.onUpdate;
    }
    this.col.references = next;
    return this;
  }

  /**
   * Mark this column as referencing the given table.
   *
   * @param {string} table
   * @returns {this}
   */
  on(table: string): this {
    const current = this.col.references;
    const next: ForeignKeyDefinition = {
      table,
      column: current?.column ?? 'id',
    };
    if (current?.onDelete !== undefined) {
      next.onDelete = current.onDelete;
    }
    if (current?.onUpdate !== undefined) {
      next.onUpdate = current.onUpdate;
    }
    this.col.references = next;
    return this;
  }

  /** Add foreign key constraint */
  /**
   * @param {string} [table]
   * @param {string} [column]
   * @returns {this}
   */
  constrained(table?: string, column?: string): this {
    // Infer table from column name: user_id → users
    const inferredTable = table ?? this.col.name.replace(/_id$/, '') + 's';
    const inferredCol = column ?? 'id';
    this.references(inferredCol).on(inferredTable).onDelete('cascade');
    return this;
  }

  /**
   * @param {'cascade' | 'restrict' | 'set null' | 'no action'} action
   * @returns {this}
   */
  onDelete(action: 'cascade' | 'restrict' | 'set null' | 'no action'): this {
    if (this.col.references) this.col.references.onDelete = action;
    return this;
  }

  /**
   * @param {'cascade' | 'restrict' | 'set null' | 'no action'} action
   * @returns {this}
   */
  onUpdate(action: 'cascade' | 'restrict' | 'set null' | 'no action'): this {
    if (this.col.references) this.col.references.onUpdate = action;
    return this;
  }

  /** Get the final column definition */
  getDefinition(): ColumnDefinition {
    return this.col;
  }
}

// ── Blueprint (Schema Builder) ────────────────────────────
