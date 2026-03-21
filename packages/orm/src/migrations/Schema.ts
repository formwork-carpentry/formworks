/**
 * @module @formwork/orm
 * @description Schema facade — create/modify/drop tables
 * @patterns Facade
 */

import { Blueprint } from './Blueprint.js';
import type { IDatabaseAdapter, CompiledQuery } from '@formwork/core/contracts';
import type { ColumnDefinition, IndexDefinition } from './column-types.js';

/**
 * Schema — high-level DDL API: create/drop tables using {@link Blueprint}.
 *
 * Compiles to {@link CompiledQuery} and executes via `IDatabaseAdapter`.
 *
 * @example
 * ```ts
 * const schema = new Schema(adapter);
 * await schema.create('posts', (t) => {
 *   t.id();
 *   t.string('title');
 *   t.timestamps();
 * });
 * ```
 */
export class Schema {
  constructor(private adapter: IDatabaseAdapter) {}

  /** Create a new table */
  /**
   * @param {string} table
   * @param {(blueprint: Blueprint} callback
   * @returns {Promise<void>}
   */
  async create(table: string, callback: (blueprint: Blueprint) => void): Promise<void> {
    const bp = new Blueprint(table);
    bp.operation = 'create';
    callback(bp);
    await this.adapter.execute(this.compileCreate(bp));

    for (const index of this.compileIndexes(bp)) {
      await this.adapter.execute(index);
    }
  }

  /** Drop a table if it exists */
  /**
   * @param {string} table
   * @returns {Promise<void>}
   */
  async dropIfExists(table: string): Promise<void> {
    await this.adapter.execute({
      sql: `DROP TABLE IF EXISTS ${table}`,
      bindings: [],
      type: 'schema',
    });
  }

  /** Compile a CREATE TABLE statement from a Blueprint */
  /**
   * @param {Blueprint} bp
   * @returns {CompiledQuery}
   */
  compileCreate(bp: Blueprint): CompiledQuery {
    const parts = bp.columns.map((col) => this.compileColumn(col));

    // Add foreign key constraints
    const fks = bp.columns
      .filter((c) => c.references)
      .map((c) => {
        const ref = c.references!;
        let fk = `FOREIGN KEY (${c.name}) REFERENCES ${ref.table}(${ref.column})`;
        if (ref.onDelete) fk += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
        if (ref.onUpdate) fk += ` ON UPDATE ${ref.onUpdate.toUpperCase()}`;
        return fk;
      });

    const allParts = [...parts, ...fks].join(', ');
    const sql = `CREATE TABLE ${bp.tableName} (${allParts})`;

    return { sql, bindings: [], type: 'schema' };
  }

  /**
   * Compile table-level indexes into individual CREATE INDEX statements.
   *
   * @param {Blueprint} bp
   * @returns {CompiledQuery[]}
   */
  compileIndexes(bp: Blueprint): CompiledQuery[] {
    return bp.indexes.map((index) => this.compileIndex(bp.tableName, index));
  }

  private compileColumn(col: ColumnDefinition): string {
    let sql = col.name;

    // Type mapping
    switch (col.type) {
      case 'id': sql += ' INTEGER PRIMARY KEY AUTOINCREMENT'; return sql;
      case 'uuid': sql += ' VARCHAR(36)'; break;
      case 'string': sql += ` VARCHAR(${col.length ?? 255})`; break;
      case 'text': sql += ' TEXT'; break;
      case 'integer': sql += ' INTEGER'; break;
      case 'bigInteger': sql += ' BIGINT'; break;
      case 'float': sql += ' REAL'; break;
      case 'decimal': sql += ` DECIMAL(${col.precision ?? 8},${col.scale ?? 2})`; break;
      case 'boolean': sql += ' BOOLEAN'; break;
      case 'date': sql += ' DATE'; break;
      case 'datetime': sql += ' DATETIME'; break;
      case 'timestamp': sql += ' TIMESTAMP'; break;
      case 'json': sql += ' JSON'; break;
      case 'binary': sql += ' BLOB'; break;
      case 'enum': sql += ' VARCHAR(255)'; break;
    }

    if (col.unsigned) sql += ' UNSIGNED';
    if (col.primaryKey) sql += ' PRIMARY KEY';
    if (!col.nullable) sql += ' NOT NULL';
    if (col.unique) sql += ' UNIQUE';
    if (col.defaultValue !== undefined) {
      sql += ` DEFAULT ${typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue}`;
    }

    return sql;
  }

  private compileIndex(tableName: string, index: IndexDefinition): CompiledQuery {
    return {
      sql: `CREATE INDEX ${index.name} ON ${tableName} (${index.columns.join(', ')})`,
      bindings: [],
      type: 'schema',
    };
  }
}

// ── Migration Runner ──────────────────────────────────────
