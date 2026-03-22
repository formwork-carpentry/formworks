/**
 * @module @formwork/db
 * @description In-memory SQLite-style adapter for tests — no native dependencies.
 */
/**
 * SQLite in-memory adapter for tests/dev (simplified SQL, not a full engine).
 *
 * @example
 * ```ts
 * const db = new MemoryDbAdapter();
 * await db.execute({ sql: 'CREATE TABLE t (id)', bindings: [], type: 'schema' });
 * ```
 */
export class SQLiteMemoryAdapter {
    tables = new Map();
    autoIncrements = new Map();
    queryLog = [];
    driverName() { return 'sqlite-memory'; }
    async connect() { }
    async disconnect() { this.tables.clear(); }
    async beginTransaction() { }
    async commit() { }
    async rollback() { }
    async run(sql, params = []) {
        const result = await this.execute({ sql, bindings: params, type: 'raw' });
        return {
            affectedRows: result.rowCount,
            insertId: typeof result.insertId === 'number' ? result.insertId : undefined,
        };
    }
    async close() {
        await this.disconnect();
    }
    async execute(arg1, arg2 = []) {
        const query = typeof arg1 === 'string'
            ? { sql: arg1, bindings: arg2, type: 'raw' }
            : arg1;
        this.queryLog.push(query);
        const sqlUpper = query.sql.trim().toUpperCase();
        const result = sqlUpper.startsWith('CREATE TABLE') ? this.executeCreateTable(query)
            : sqlUpper.startsWith('DROP TABLE') ? this.executeDrop(query)
                : sqlUpper.startsWith('INSERT') ? this.executeInsert(query)
                    : sqlUpper.startsWith('SELECT') ? this.executeSelect(query)
                        : sqlUpper.startsWith('UPDATE') ? this.executeUpdate(query)
                            : sqlUpper.startsWith('DELETE') ? this.executeDelete(query)
                                : { rows: [], rowCount: 0 };
        return typeof arg1 === 'string' ? result.rows : result;
    }
    async raw(sql, bindings = []) {
        return this.execute({ sql, bindings, type: 'raw' });
    }
    executeCreateTable(query) {
        const match = query.sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
        if (match) {
            const table = match[1];
            if (!this.tables.has(table)) {
                this.tables.set(table, []);
                this.autoIncrements.set(table, 0);
            }
        }
        return { rows: [], rowCount: 0 };
    }
    executeDrop(query) {
        const match = query.sql.match(/DROP TABLE (?:IF EXISTS )?(\w+)/i);
        if (match) {
            this.tables.delete(match[1]);
            this.autoIncrements.delete(match[1]);
        }
        return { rows: [], rowCount: 0 };
    }
    executeInsert(query) {
        const match = query.sql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES/i);
        if (!match)
            return { rows: [], rowCount: 0 };
        const table = match[1];
        const columns = match[2].split(',').map((c) => c.trim());
        const rows = this.tables.get(table) ?? [];
        const valuePlaceholders = query.sql.match(/\(([^)]*\?[^)]*)\)/g);
        if (!valuePlaceholders)
            return { rows: [], rowCount: 0 };
        let bindIdx = 0;
        let lastId = this.autoIncrements.get(table) ?? 0;
        for (const _ of valuePlaceholders) {
            const row = {};
            for (const col of columns) {
                row[col] = query.bindings[bindIdx++];
            }
            if (!('id' in row)) {
                lastId++;
                row['id'] = lastId;
            }
            rows.push(row);
        }
        this.autoIncrements.set(table, lastId);
        if (!this.tables.has(table))
            this.tables.set(table, rows);
        return { rows: [], rowCount: valuePlaceholders.length, insertId: lastId };
    }
    executeSelect(query) {
        const match = query.sql.match(/FROM (\w+)/i);
        if (!match)
            return { rows: [], rowCount: 0 };
        const table = match[1];
        let rows = [...(this.tables.get(table) ?? [])];
        const whereMatch = query.sql.match(/WHERE (.+?)(?:ORDER|LIMIT|GROUP|$)/i);
        if (whereMatch && query.bindings.length > 0) {
            rows = this.applyWheres(rows, query.sql, query.bindings);
        }
        const limitMatch = query.sql.match(/LIMIT (\d+)/i);
        if (limitMatch)
            rows = rows.slice(0, Number(limitMatch[1]));
        const offsetMatch = query.sql.match(/OFFSET (\d+)/i);
        if (offsetMatch)
            rows = rows.slice(Number(offsetMatch[1]));
        return { rows, rowCount: rows.length };
    }
    executeUpdate(query) {
        const match = query.sql.match(/UPDATE (\w+) SET (.+?)(?:WHERE|$)/i);
        if (!match)
            return { rows: [], rowCount: 0 };
        const table = match[1];
        const rows = this.tables.get(table) ?? [];
        const setCols = match[2].split(',').map((s) => s.trim().split('=')[0].trim());
        const setValues = query.bindings.slice(0, setCols.length);
        const whereBindings = query.bindings.slice(setCols.length);
        let affected = 0;
        const filtered = query.sql.includes('WHERE')
            ? this.filterRows(rows, query.sql.substring(query.sql.toUpperCase().indexOf('WHERE')), whereBindings)
            : rows;
        for (const row of filtered) {
            for (let i = 0; i < setCols.length; i++) {
                row[setCols[i]] = setValues[i];
            }
            affected++;
        }
        return { rows: [], rowCount: affected };
    }
    executeDelete(query) {
        const match = query.sql.match(/DELETE FROM (\w+)/i);
        if (!match)
            return { rows: [], rowCount: 0 };
        const table = match[1];
        const rows = this.tables.get(table) ?? [];
        if (!query.sql.toUpperCase().includes('WHERE')) {
            const count = rows.length;
            this.tables.set(table, []);
            return { rows: [], rowCount: count };
        }
        const toDelete = this.applyWheres(rows, query.sql, query.bindings);
        const toDeleteSet = new Set(toDelete);
        this.tables.set(table, rows.filter((r) => !toDeleteSet.has(r)));
        return { rows: [], rowCount: toDelete.length };
    }
    applyWheres(rows, sql, bindings) {
        const whereMatch = sql.match(/WHERE (\w+)\s*=\s*\?/i);
        if (whereMatch && bindings.length > 0) {
            const col = whereMatch[1];
            const val = bindings[bindings.length > 1 ? bindings.length - 1 : 0];
            return rows.filter((r) => r[col] === val);
        }
        return rows;
    }
    filterRows(rows, whereSql, bindings) {
        return this.applyWheres(rows, whereSql, bindings);
    }
    getTable(name) { return [...(this.tables.get(name) ?? [])]; }
    getTableNames() { return [...this.tables.keys()]; }
    getQueryLog() { return [...this.queryLog]; }
    clearQueryLog() { this.queryLog = []; }
    reset() { this.tables.clear(); this.autoIncrements.clear(); this.queryLog = []; }
}
/**
 * DatabaseManager-compatible driver factory for the in-memory adapter.
 */
export const memoryAdapter = () => new SQLiteMemoryAdapter();
//# sourceMappingURL=index.js.map