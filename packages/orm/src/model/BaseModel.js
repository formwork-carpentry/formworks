/**
 * @module @formwork/orm
 * @description BaseModel — Active Record pattern with dirty tracking, timestamps, soft deletes
 * @patterns Active Record, Memento (dirty tracking/getOriginal), Template Method (lifecycle hooks),
 *           Observer (model events), Strategy (casting)
 * @principles SRP — model represents a single DB record; OCP — extend via events/hooks;
 *             DIP — depends on IDatabaseAdapter, never on concrete DB driver
 */
import { QueryBuilder } from '../query/QueryBuilder.js';
export { ModelQueryBuilder } from './model-query.js';
import { ModelQueryBuilder } from './model-query.js';
// ── BaseModel ─────────────────────────────────────────────
/**
 * Active Record base class for modeling a single table row.
 *
 * Extend this class per model, then set the {@link BaseModel.adapter} at boot
 * (or in tests) so query execution can happen via the configured database adapter.
 *
 * @example
 * ```ts
 * import { BaseModel, MockDatabaseAdapter } from '@formwork/orm';
 *
 * class User extends BaseModel {
 *   static table = 'users';
 *   static fillable = ['name'];
 * }
 *
 * const db = new MockDatabaseAdapter().queueResult([{ id: 1, name: 'Alice' }], 1);
 * BaseModel.adapter = db;
 *
 * const user = await User.find(1);
 * // user?.attributes.name === 'Alice'
 * ```
 *
 * @see QueryBuilder — Underlying fluent query builder
 */
export class BaseModel {
    // ── Static Configuration (overridden per model) ─────────
    /** Database table name */
    static table = '';
    /** Primary key column */
    static primaryKey = 'id';
    /** Enable auto timestamps (created_at, updated_at) */
    static timestamps = true;
    /** Enable auto userstamps (created_by, updated_by) — tracks WHO changed a record */
    static userstamps = false;
    /** Enable soft deletes */
    static softDeletes = false;
    /** Mass-assignable attributes (empty = use guarded) */
    static fillable = [];
    /** Non-mass-assignable attributes */
    static guarded = ['id'];
    /** Attribute casts */
    static casts = {};
    /** Created-at column name */
    static createdAtColumn = 'created_at';
    /** Updated-at column name */
    static updatedAtColumn = 'updated_at';
    /** Deleted-at column name (soft deletes) */
    static deletedAtColumn = 'deleted_at';
    /** Created-by column name (userstamps) */
    static createdByColumn = 'created_by';
    /** Updated-by column name (userstamps) */
    static updatedByColumn = 'updated_by';
    /** Database adapter — set once at boot by the ORM service provider */
    static adapter;
    /**
     * Userstamp resolver — returns the current authenticated user's ID.
     * Set once at boot by the auth service provider. Keeps BaseModel decoupled from auth (DIP).
     *
     * @example
     * ```typescript
     * // In AuthServiceProvider.boot():
     * BaseModel.userResolver = () => Auth.id();
     * ```
     */
    static userResolver = null;
    /** Registered model event handlers */
    static eventHandlers = new Map();
    // ── Instance State ──────────────────────────────────────
    /** Current attribute values */
    attributes = {};
    /** Original values from last sync (Memento pattern) */
    original = {};
    /** Whether this model exists in the database */
    existsInDb = false;
    constructor(attributes = {}) {
        this.fill(attributes);
        this.syncOriginal();
    }
    // ── Static Query Methods ────────────────────────────────
    /** Start a new query on this model's table */
    static query() {
        const qb = new QueryBuilder(this.adapter, this.table);
        if (this.softDeletes) {
            qb.whereNull(this.deletedAtColumn);
        }
        return qb;
    }
    /** Find a model by primary key */
    static async find(id) {
        const row = await this.query().where(this.primaryKey, id).first();
        if (!row)
            return null;
        return this.hydrate(row);
    }
    /** Find a model by primary key or throw */
    static async findOrFail(id) {
        const model = await this.find(id);
        if (!model) {
            throw new Error(`${this.name} with ${this.primaryKey} "${id}" not found.`);
        }
        return model;
    }
    /** Get all models */
    static async all() {
        const rows = await this.query().get();
        return rows.map((row) => this.hydrate(row));
    }
    /** Convenience: where clause returning query builder */
    static where(column, opOrVal, value) {
        const qb = this.query();
        qb.where(column, opOrVal, value);
        return new ModelQueryBuilder(qb, this);
    }
    /** Include soft-deleted records */
    static withTrashed() {
        return new QueryBuilder(this.adapter, this.table);
    }
    /** Create and persist a new model in one step */
    static async create(attributes) {
        const model = new this(attributes);
        await model.save();
        return model;
    }
    /** Hydrate a model instance from a database row */
    static hydrate(row) {
        const model = new this();
        model.attributes = { ...row };
        model.original = { ...row };
        model.existsInDb = true;
        return model;
    }
    // ── Instance CRUD ───────────────────────────────────────
    /** Save the model — insert if new, update if existing */
    async save() {
        const ctor = this.constructor;
        if (await this.fireEvent('saving') === false)
            return;
        if (this.existsInDb) {
            await this.performUpdate(ctor);
        }
        else {
            await this.performInsert(ctor);
        }
        await this.fireEvent('saved');
        this.syncOriginal();
    }
    /** Update specific attributes and save */
    /**
     * @param {Dictionary} data
     * @returns {Promise<void>}
     */
    async update(data) {
        this.fill(data);
        await this.save();
    }
    /** Delete the model (or soft-delete if enabled) */
    async delete() {
        const ctor = this.constructor;
        if (await this.fireEvent('deleting') === false)
            return;
        if (ctor.softDeletes) {
            const now = new Date().toISOString();
            this.attributes[ctor.deletedAtColumn] = now;
            await new QueryBuilder(ctor.adapter, ctor.table)
                .where(ctor.primaryKey, this.getKey())
                .update({ [ctor.deletedAtColumn]: now });
        }
        else {
            await new QueryBuilder(ctor.adapter, ctor.table)
                .where(ctor.primaryKey, this.getKey())
                .delete();
            this.existsInDb = false;
        }
        await this.fireEvent('deleted');
    }
    /** Restore a soft-deleted model */
    async restore() {
        const ctor = this.constructor;
        if (!ctor.softDeletes)
            throw new Error(`${ctor.name} does not use soft deletes.`);
        if (await this.fireEvent('restoring') === false)
            return;
        this.attributes[ctor.deletedAtColumn] = null;
        await new QueryBuilder(ctor.adapter, ctor.table)
            .where(ctor.primaryKey, this.getKey())
            .update({ [ctor.deletedAtColumn]: null });
        await this.fireEvent('restored');
        this.syncOriginal();
    }
    // ── Mass Assignment ─────────────────────────────────────
    /** Fill attributes with mass assignment protection */
    /**
     * @param {Dictionary} data
     * @returns {this}
     */
    fill(data) {
        const ctor = this.constructor;
        for (const [key, value] of Object.entries(data)) {
            if (this.isFillable(key, ctor)) {
                this.setAttribute(key, value);
            }
        }
        return this;
    }
    isFillable(key, ctor) {
        // If fillable is set, only those keys allowed
        if (ctor.fillable.length > 0) {
            return ctor.fillable.includes(key);
        }
        // Otherwise, everything except guarded
        return !ctor.guarded.includes(key);
    }
    // ── Attribute Access ────────────────────────────────────
    /** Get an attribute value (with casting) */
    /**
     * @param {string} key
     * @returns {T}
     */
    getAttribute(key) {
        const ctor = this.constructor;
        const raw = this.attributes[key];
        const castType = ctor.casts[key];
        if (castType && raw !== undefined && raw !== null) {
            return this.castValue(raw, castType);
        }
        return raw;
    }
    /** Set an attribute value */
    /**
     * @param {string} key
     * @param {unknown} value
     */
    setAttribute(key, value) {
        this.attributes[key] = value;
    }
    /** Get the primary key value */
    getKey() {
        const ctor = this.constructor;
        return this.attributes[ctor.primaryKey];
    }
    /** Get all current attributes */
    getAttributes() {
        return { ...this.attributes };
    }
    // ── Dirty Tracking (Memento Pattern) ────────────────────
    /** Whether any attribute has changed since last sync */
    /**
     * @param {string} [attribute]
     * @returns {boolean}
     */
    isDirty(attribute) {
        if (attribute) {
            return this.attributes[attribute] !== this.original[attribute];
        }
        return Object.keys(this.attributes).some((key) => this.attributes[key] !== this.original[key]);
    }
    /** Get original value(s) before modification */
    /**
     * @param {string} [attribute]
     * @returns {T}
     */
    getOriginal(attribute) {
        if (attribute)
            return this.original[attribute];
        return { ...this.original };
    }
    /** Get only the changed attributes */
    getDirty() {
        const dirty = {};
        for (const key of Object.keys(this.attributes)) {
            if (this.attributes[key] !== this.original[key]) {
                dirty[key] = this.attributes[key];
            }
        }
        return dirty;
    }
    /** Whether this model exists in the database */
    exists() {
        return this.existsInDb;
    }
    /** Whether this model has been soft-deleted */
    trashed() {
        const ctor = this.constructor;
        return ctor.softDeletes && this.attributes[ctor.deletedAtColumn] != null;
    }
    /** Convert to plain object */
    toJSON() {
        return { ...this.attributes };
    }
    /** Replicate this model (Prototype pattern — new instance, no primary key, not persisted) */
    replicate() {
        const ctor = this.constructor;
        const attrs = { ...this.attributes };
        delete attrs[ctor.primaryKey];
        if (ctor.timestamps) {
            delete attrs[ctor.createdAtColumn];
            delete attrs[ctor.updatedAtColumn];
        }
        if (ctor.userstamps) {
            delete attrs[ctor.createdByColumn];
            delete attrs[ctor.updatedByColumn];
        }
        return new ctor(attrs);
    }
    // ── Model Events (Observer Pattern) ─────────────────────
    static on(event, handler) {
        const key = `${this.name}:${event}`;
        if (!this.eventHandlers.has(key)) {
            this.eventHandlers.set(key, []);
        }
        this.eventHandlers.get(key).push(handler);
    }
    async fireEvent(event) {
        const ctor = this.constructor;
        const key = `${ctor.name}:${event}`;
        const handlers = BaseModel.eventHandlers.get(key) ?? [];
        for (const handler of handlers) {
            const result = await handler(this);
            if (result === false)
                return false;
        }
        return true;
    }
    /** Clear all event handlers (for testing) */
    static clearEvents() {
        this.eventHandlers.clear();
    }
    // ── Internal Persistence ────────────────────────────────
    async performInsert(ctor) {
        if (await this.fireEvent('creating') === false)
            return;
        if (ctor.timestamps) {
            const now = new Date().toISOString();
            this.attributes[ctor.createdAtColumn] = now;
            this.attributes[ctor.updatedAtColumn] = now;
        }
        if (ctor.userstamps) {
            const userId = BaseModel.userResolver?.() ?? null;
            this.attributes[ctor.createdByColumn] = userId;
            this.attributes[ctor.updatedByColumn] = userId;
        }
        const data = { ...this.attributes };
        // Remove undefined primary key for auto-increment
        if (data[ctor.primaryKey] === undefined) {
            delete data[ctor.primaryKey];
        }
        const result = await new QueryBuilder(ctor.adapter, ctor.table).insert(data);
        if (result.insertId !== undefined) {
            this.attributes[ctor.primaryKey] = result.insertId;
        }
        this.existsInDb = true;
        await this.fireEvent('created');
    }
    async performUpdate(ctor) {
        const dirty = this.getDirty();
        if (Object.keys(dirty).length === 0)
            return; // Nothing changed
        if (await this.fireEvent('updating') === false)
            return;
        if (ctor.timestamps) {
            dirty[ctor.updatedAtColumn] = new Date().toISOString();
            this.attributes[ctor.updatedAtColumn] = dirty[ctor.updatedAtColumn];
        }
        if (ctor.userstamps) {
            const userId = BaseModel.userResolver?.() ?? null;
            dirty[ctor.updatedByColumn] = userId;
            this.attributes[ctor.updatedByColumn] = userId;
        }
        await new QueryBuilder(ctor.adapter, ctor.table)
            .where(ctor.primaryKey, this.getKey())
            .update(dirty);
        await this.fireEvent('updated');
    }
    syncOriginal() {
        this.original = { ...this.attributes };
    }
    castValue(value, type) {
        switch (type) {
            case 'string': return String(value);
            case 'number': return Number(value);
            case 'boolean': return Boolean(value);
            case 'date': return new Date(value);
            case 'json': return typeof value === 'string' ? JSON.parse(value) : value;
            default: return value;
        }
    }
}
//# sourceMappingURL=BaseModel.js.map