/**
 * @module @formwork/orm
 * @description ModelQueryBuilder — wraps QueryBuilder to return hydrated model instances
 * @patterns Proxy (delegates to QueryBuilder)
 */
/**
 * ModelQueryBuilder — wraps {@link QueryBuilder} and returns hydrated model instances.
 *
 * Returned from `YourModel.query()`; delegates `where`, `orderBy`, etc. to the inner builder
 * and maps rows with {@link BaseModel.hydrate}.
 *
 * @example
 * ```ts
 * class Post extends BaseModel {
 *   static table = 'posts';
 * }
 * BaseModel.adapter = mockAdapter;
 * const posts = await Post.query().where('published', true).get();
 * ```
 *
 * @see BaseModel.query
 * @see QueryBuilder
 */
export class ModelQueryBuilder {
    qb;
    modelClass;
    constructor(qb, modelClass) {
        this.qb = qb;
        this.modelClass = modelClass;
    }
    /**
     * @param {string} column
     * @param {unknown} opOrVal
     * @param {unknown} [value]
     * @returns {this}
     */
    where(column, opOrVal, value) {
        this.qb.where(column, opOrVal, value);
        return this;
    }
    /**
     * @param {string} column
     * @param {unknown} opOrVal
     * @param {unknown} [value]
     * @returns {this}
     */
    orWhere(column, opOrVal, value) {
        this.qb.orWhere(column, opOrVal, value);
        return this;
    }
    /**
     * @param {string} column
     * @param {'asc' | 'desc'} [dir]
     * @returns {this}
     */
    orderBy(column, dir = 'asc') {
        this.qb.orderBy(column, dir);
        return this;
    }
    /**
     * @param {number} n
     * @returns {this}
     */
    limit(n) { this.qb.limit(n); return this; }
    /** Get the underlying AST for testing */
    getAST() { return this.qb.getAST(); }
    async get() {
        const rows = await this.qb.get();
        return rows.map((row) => this.modelClass.hydrate(row));
    }
    async first() {
        const row = await this.qb.first();
        return row ? this.modelClass.hydrate(row) : null;
    }
    async count() {
        return this.qb.count();
    }
}
//# sourceMappingURL=model-query.js.map