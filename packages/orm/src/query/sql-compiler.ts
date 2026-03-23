/**
 * @module @carpentry/orm
 * @description SQL compiler — converts QueryAST into SQL strings with parameterized bindings
 * @patterns Visitor (traverses AST nodes), Strategy (compilation per statement type)
 * @principles SRP (only SQL generation), OCP (add statement types without modifying existing)
 */

import type { Dictionary } from '@carpentry/core/types';

/** AST node types used by the compiler */
export interface WhereClause { column: string; operator: string; value: unknown; boolean: 'and' | 'or'; }
export interface OrderByClause { column: string; direction: 'asc' | 'desc'; }
export interface JoinClause { type: 'inner' | 'left' | 'right'; table: string; localKey: string; operator: string; foreignKey: string; }
export interface CompiledQuery { sql: string; bindings: unknown[]; type: string; }

export interface QueryAST {
  type: 'select' | 'insert' | 'update' | 'delete' | 'aggregate' | 'raw';
  table: string;
  columns: string[];
  wheres: WhereClause[];
  orders: OrderByClause[];
  joins: JoinClause[];
  groupBys: string[];
  havings: WhereClause[];
  distinct: boolean;
  limitCount?: number;
  offsetCount?: number;
  data?: Dictionary | Dictionary[];
  aggregateFunction?: string;
  aggregateColumn?: string;
}

/** Compile a QueryAST into a parameterized SQL query. */
/**
 * @param {QueryAST} ast
 * @returns {CompiledQuery}
 */
export function compileQuery(ast: QueryAST): CompiledQuery {
  const bindings: unknown[] = [];

  /**
   * @param {unknown} [ast.type === 'select' || ast.type === 'aggregate']
   */
  if (ast.type === 'select' || ast.type === 'aggregate') {
    let sql = `SELECT ${ast.distinct ? 'DISTINCT ' : ''}${ast.columns.join(', ')} FROM ${ast.table}`;
    sql += compileJoins(ast.joins);
    sql += compileWheres(ast.wheres, bindings);
    sql += compileGroupBy(ast.groupBys);
    sql += compileHavings(ast.havings, bindings);
    sql += compileOrders(ast.orders);
    if (ast.limitCount !== undefined) sql += ` LIMIT ${ast.limitCount}`;
    if (ast.offsetCount !== undefined) sql += ` OFFSET ${ast.offsetCount}`;
    return { sql, bindings, type: 'select' };
  }

  /**
   * @param {unknown} [ast.type === 'insert' && ast.data]
   */
  if (ast.type === 'insert' && ast.data) {
    const rows = Array.isArray(ast.data) ? ast.data : [ast.data];
    const cols = Object.keys(rows[0]);
    const ph = rows.map((row) =>
      `(${cols.map((c) => { bindings.push(row[c]); return '?'; }).join(', ')})`
    ).join(', ');
    return { sql: `INSERT INTO ${ast.table} (${cols.join(', ')}) VALUES ${ph}`, bindings, type: 'insert' };
  }

  /**
   * @param {unknown} [ast.type === 'update' && ast.data]
   */
  if (ast.type === 'update' && ast.data) {
    const sets = Object.entries(ast.data as Dictionary).map(([c, v]) => { bindings.push(v); return `${c} = ?`; });
    let sql = `UPDATE ${ast.table} SET ${sets.join(', ')}`;
    sql += compileWheres(ast.wheres, bindings);
    return { sql, bindings, type: 'update' };
  }

  /**
   * @param {unknown} [ast.type === 'delete']
   */
  if (ast.type === 'delete') {
    let sql = `DELETE FROM ${ast.table}`;
    sql += compileWheres(ast.wheres, bindings);
    return { sql, bindings, type: 'delete' };
  }

  return { sql: '', bindings: [], type: 'raw' };
}

/**
 * @param {WhereClause[]} wheres
 * @param {unknown[]} bindings
 * @returns {string}
 */
export function compileWheres(wheres: WhereClause[], bindings: unknown[]): string {
  /**
   * @param {unknown} [wheres.length === 0]
   */
  if (wheres.length === 0) return '';
  return wheres.map((w, i) => {
    const pfx = i === 0 ? ' WHERE' : ` ${w.boolean.toUpperCase()}`;
    if (w.operator === 'IS NULL' || w.operator === 'IS NOT NULL') return `${pfx} ${w.column} ${w.operator}`;
    if (w.operator === 'IN') {
      const v = w.value as unknown[];
      return `${pfx} ${w.column} IN (${v.map((x) => { bindings.push(x); return '?'; }).join(', ')})`;
    }
    if (w.operator === 'BETWEEN') {
      const [lo, hi] = w.value as [unknown, unknown];
      bindings.push(lo, hi);
      return `${pfx} ${w.column} BETWEEN ? AND ?`;
    }
    bindings.push(w.value);
    return `${pfx} ${w.column} ${w.operator} ?`;
  }).join('');
}

/**
 * @param {JoinClause[]} joins
 * @returns {string}
 */
export function compileJoins(joins: JoinClause[]): string {
  return joins.map((j) => {
    const t = j.type === 'inner' ? 'JOIN' : j.type === 'left' ? 'LEFT JOIN' : 'RIGHT JOIN';
    return ` ${t} ${j.table} ON ${j.localKey} ${j.operator} ${j.foreignKey}`;
  }).join('');
}

/**
 * @param {OrderByClause[]} orders
 * @returns {string}
 */
export function compileOrders(orders: OrderByClause[]): string {
  /**
   * @param {unknown} [orders.length === 0]
   */
  if (orders.length === 0) return '';
  return ` ORDER BY ${orders.map((o) => `${o.column} ${o.direction.toUpperCase()}`).join(', ')}`;
}

/**
 * @param {string[]} cols
 * @returns {string}
 */
export function compileGroupBy(cols: string[]): string {
  return cols.length === 0 ? '' : ` GROUP BY ${cols.join(', ')}`;
}

/**
 * @param {WhereClause[]} havings
 * @param {unknown[]} bindings
 * @returns {string}
 */
export function compileHavings(havings: WhereClause[], bindings: unknown[]): string {
  /**
   * @param {unknown} [havings.length === 0]
   */
  if (havings.length === 0) return '';
  return havings.map((h, i) => {
    const pfx = i === 0 ? ' HAVING' : ` ${h.boolean.toUpperCase()}`;
    bindings.push(h.value);
    return `${pfx} ${h.column} ${h.operator} ?`;
  }).join('');
}
