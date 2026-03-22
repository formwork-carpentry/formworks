/**
 * @module @formwork/orm
 * @description Fluent QueryBuilder — produces AST consumed by database adapters, not raw SQL
 * @patterns Builder (fluent chaining), Visitor (AST traversal by adapters)
 * @principles SRP — builds queries only; DIP — depends on IDatabaseAdapter interface
 */
import { compileQuery } from './sql-compiler.js';
/**
 * Fluent query builder that produces a query AST consumed by database adapters.
 *
 * Use {@link QueryBuilder} indirectly via {@link BaseModel.query()} or directly when
 * you need adapter-driven query compilation.
 *
 * @example
 * ```ts
 * import { QueryBuilder, MockDatabaseAdapter } from '@formwork/orm';
 *
 * const adapter = new MockDatabaseAdapter().queueResult([{ id: 1 }], 1);
 * const qb = new QueryBuilder(adapter, 'users');
 *
 * const row = await qb.where('id', 1).first();
 * ```
 *
 * @see BaseModel — Convenience static query entry point
 */
export class QueryBuilder {
    ast;
    adapter;
    constructor(adapter, table) {
        this.adapter = adapter;
        this.ast = {
            type: 'select', table, columns: ['*'],
            wheres: [], orders: [], joins: [], groupBys: [], havings: [],
            distinct: false,
        };
    }
    /**
     * @param {string[]} ...columns
     * @returns {this}
     */
    select(...columns) {
        this.ast.columns = columns.length > 0 ? columns : ['*'];
        return this;
    }
    /**
     * Add a raw expression to the select columns.
     * @example qb.selectRaw('COUNT(comments.id) as comments_count')
     */
    selectRaw(expression) {
        if (this.ast.columns.length === 1 && this.ast.columns[0] === '*') {
            this.ast.columns = [this.ast.table + '.*', expression];
        }
        else {
            this.ast.columns.push(expression);
        }
        return this;
    }
    /**
     * Add a subselect count for a related table.
     * Produces: SELECT *, (SELECT COUNT(*) FROM related WHERE related.fk = table.pk) as related_count
     *
     * @param relation - Name used for the count alias (e.g., 'comments' → comments_count)
     * @param relatedTable - The related table to count
     * @param foreignKey - The FK column in the related table
     * @param localKey - The local key column (default: 'id')
     *
     * @example
     * ```ts
     * qb.withCount('comments', 'comments', 'post_id')
     * // SELECT posts.*, (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) as comments_count
     * ```
     */
    withCount(relation, relatedTable, foreignKey, localKey = 'id') {
        const subselect = `(SELECT COUNT(*) FROM ${relatedTable} WHERE ${relatedTable}.${foreignKey} = ${this.ast.table}.${localKey}) as ${relation}_count`;
        return this.selectRaw(subselect);
    }
    distinct() { this.ast.distinct = true; return this; }
    /**
     * @param {string} column
     * @param {unknown} opOrVal
     * @param {unknown} [value]
     * @returns {this}
     */
    where(column, opOrVal, value) {
        if (value === undefined) {
            this.ast.wheres.push({ column, operator: '=', value: opOrVal, boolean: 'and' });
        }
        else {
            this.ast.wheres.push({ column, operator: opOrVal, value, boolean: 'and' });
        }
        return this;
    }
    /**
     * @param {string} column
     * @param {unknown} opOrVal
     * @param {unknown} [value]
     * @returns {this}
     */
    orWhere(column, opOrVal, value) {
        if (value === undefined) {
            this.ast.wheres.push({ column, operator: '=', value: opOrVal, boolean: 'or' });
        }
        else {
            this.ast.wheres.push({ column, operator: opOrVal, value, boolean: 'or' });
        }
        return this;
    }
    /**
     * @param {string} column
     * @param {unknown[]} values
     * @returns {this}
     */
    whereIn(column, values) {
        this.ast.wheres.push({ column, operator: 'IN', value: values, boolean: 'and' });
        return this;
    }
    /**
     * @param {string} column
     * @returns {this}
     */
    whereNull(column) {
        this.ast.wheres.push({ column, operator: 'IS NULL', value: null, boolean: 'and' });
        return this;
    }
    /**
     * @param {string} column
     * @returns {this}
     */
    whereNotNull(column) {
        this.ast.wheres.push({ column, operator: 'IS NOT NULL', value: null, boolean: 'and' });
        return this;
    }
    /**
     * @param {string} column
     * @param {[unknown} range
     * @param {unknown} unknown]
     * @returns {this}
     */
    whereBetween(column, range) {
        this.ast.wheres.push({ column, operator: 'BETWEEN', value: range, boolean: 'and' });
        return this;
    }
    /**
     * @param {string} table
     * @param {string} local
     * @param {string} op
     * @param {string} foreign
     * @returns {this}
     */
    join(table, local, op, foreign) {
        this.ast.joins.push({ table, localKey: local, operator: op, foreignKey: foreign, type: 'inner' });
        return this;
    }
    /**
     * @param {string} table
     * @param {string} local
     * @param {string} op
     * @param {string} foreign
     * @returns {this}
     */
    leftJoin(table, local, op, foreign) {
        this.ast.joins.push({ table, localKey: local, operator: op, foreignKey: foreign, type: 'left' });
        return this;
    }
    /**
     * @param {string} column
     * @param {'asc' | 'desc'} [direction]
     * @returns {this}
     */
    orderBy(column, direction = 'asc') {
        this.ast.orders.push({ column, direction });
        return this;
    }
    /**
     * @param {string[]} ...columns
     * @returns {this}
     */
    groupBy(...columns) { this.ast.groupBys.push(...columns); return this; }
    /**
     * @param {string} column
     * @param {string} operator
     * @param {unknown} value
     * @returns {this}
     */
    having(column, operator, value) {
        this.ast.havings.push({ column, operator, value, boolean: 'and' });
        return this;
    }
    /**
     * @param {number} count
     * @returns {this}
     */
    limit(count) { this.ast.limitCount = count; return this; }
    /**
     * @param {number} count
     * @returns {this}
     */
    offset(count) { this.ast.offsetCount = count; return this; }
    // ── Terminal operations ─────────────────────────────────
    async get() {
        this.ast.type = 'select';
        const compiled = this.compile(this.ast);
        const result = await this.adapter.execute(compiled);
        return result.rows;
    }
    async first() {
        this.ast.limitCount = 1;
        const rows = await this.get();
        return rows[0] ?? null;
    }
    async firstOrFail() {
        const result = await this.first();
        if (!result)
            throw new Error(`No results found for query on "${this.ast.table}".`);
        return result;
    }
    /**
     * @param {string} [column]
     * @returns {Promise<number>}
     */
    async count(column = '*') { return this.aggregate('COUNT', column); }
    /**
     * @param {string} column
     * @returns {Promise<number>}
     */
    async sum(column) { return this.aggregate('SUM', column); }
    /**
     * @param {string} column
     * @returns {Promise<number>}
     */
    async avg(column) { return this.aggregate('AVG', column); }
    /**
     * @param {string} column
     * @returns {Promise<number>}
     */
    async min(column) { return this.aggregate('MIN', column); }
    /**
     * @param {string} column
     * @returns {Promise<number>}
     */
    async max(column) { return this.aggregate('MAX', column); }
    /**
     * @param {number} [page]
     * @param {number} [perPage]
     * @returns {Promise<IPaginator<T>>}
     */
    async paginate(page = 1, perPage = 15) {
        const countQb = this.clone();
        countQb.ast.orders = [];
        countQb.ast.limitCount = undefined;
        countQb.ast.offsetCount = undefined;
        const total = await countQb.count();
        this.ast.limitCount = perPage;
        this.ast.offsetCount = (page - 1) * perPage;
        const data = await this.get();
        const lastPage = Math.ceil(total / perPage);
        return { data, total, perPage, currentPage: page, lastPage, hasMorePages: page < lastPage };
    }
    /**
     * @param {number} size
     * @param {(rows: T[]} callback
     * @returns {Promise<void>}
     */
    async chunk(size, callback) {
        let page = 1;
        while (true) {
            const c = this.clone();
            c.ast.limitCount = size;
            c.ast.offsetCount = (page - 1) * size;
            const rows = await c.get();
            if (rows.length === 0)
                break;
            await callback(rows);
            if (rows.length < size)
                break;
            page++;
        }
    }
    /**
     * @param {Dictionary | Dictionary[]} data
     * @returns {Promise<QueryResult>}
     */
    async insert(data) {
        return this.adapter.execute(this.compile({ ...this.ast, type: 'insert', data }));
    }
    /**
     * @param {Dictionary} data
     * @returns {Promise<number>}
     */
    async update(data) {
        const r = await this.adapter.execute(this.compile({ ...this.ast, type: 'update', data }));
        return r.rowCount;
    }
    async delete() {
        const r = await this.adapter.execute(this.compile({ ...this.ast, type: 'delete' }));
        return r.rowCount;
    }
    /** Expose AST for testing and adapter inspection */
    getAST() { return { ...this.ast }; }
    toCompiledQuery() { return this.compile(this.ast); }
    // ── Internal ────────────────────────────────────────────
    async aggregate(fn, column) {
        const aggAst = {
            ...this.ast, type: 'aggregate',
            aggregateFunction: fn, aggregateColumn: column,
            columns: [`${fn}(${column}) as aggregate`],
            orders: [], limitCount: undefined, offsetCount: undefined,
        };
        const result = await this.adapter.execute(this.compile(aggAst));
        return result.rows[0]?.aggregate ?? 0;
    }
    compile(ast) {
        return compileQuery(ast);
    }
    clone() {
        const qb = new QueryBuilder(this.adapter, this.ast.table);
        qb.ast = JSON.parse(JSON.stringify(this.ast));
        return qb;
    }
}
//# sourceMappingURL=QueryBuilder.js.map