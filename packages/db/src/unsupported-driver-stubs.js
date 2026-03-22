/**
 * @module @formwork/db
 * @description Stub IDatabaseAdapter implementations for missing native driver packages.
 */
import { DatabaseDriverDependencyError, DatabaseOperationError } from './exceptions/base.js';
export class UnsupportedDriverAdapter {
    name;
    connectMessage;
    runMessage;
    executeMessage;
    constructor(name, connectMessage, runMessage, executeMessage = 'Not connected.') {
        this.name = name;
        this.connectMessage = connectMessage;
        this.runMessage = runMessage;
        this.executeMessage = executeMessage;
    }
    driverName() {
        return this.name;
    }
    async connect() {
        throw new DatabaseDriverDependencyError(this.name, this.connectMessage);
    }
    async disconnect() { }
    async beginTransaction() { }
    async commit() { }
    async rollback() { }
    async close() {
        await this.disconnect();
    }
    async run(_sql, _bindings = []) {
        throw new DatabaseOperationError(this.name, 'run', this.runMessage);
    }
    async execute(_query) {
        throw new DatabaseOperationError(this.name, 'execute', this.executeMessage);
    }
    async raw(_sql, _bindings) {
        throw new DatabaseOperationError(this.name, 'raw', this.executeMessage);
    }
}
export class PostgresAdapterStub extends UnsupportedDriverAdapter {
    constructor() {
        super('postgres', 'PostgreSQL driver is not installed. Run: npm install pg', 'PostgreSQL adapter is unavailable.');
    }
}
export class MySQLAdapterStub extends UnsupportedDriverAdapter {
    constructor() {
        super('mysql', 'MySQL driver is not installed. Run: npm install mysql2', 'MySQL adapter is unavailable.');
    }
}
export class MongoDBAdapterStub extends UnsupportedDriverAdapter {
    constructor() {
        super('mongodb', 'MongoDB driver is not installed. Run: npm install mongodb', 'MongoDB adapter is unavailable.');
    }
}
//# sourceMappingURL=unsupported-driver-stubs.js.map