/**
 * @module @formwork/admin
 * @description AdminResource — declarative CRUD resource definition
 * @patterns Template Method
 */

import { AdminFieldBuilder } from "./field-builder.js";
import type { AdminAction, AdminField, AdminFilter, FieldType } from "./types.js";

/**
 * AdminResource — declarative CRUD resource definition.
 *
 * Use it to define fields, filters, and actions. Then register the resource
 * with {@link AdminPanel}.
 *
 * @example
 * ```ts
 * const panel = new AdminPanel().setPath('/admin');
 *
 * panel.register(
 *   new AdminResource({ name: 'users', label: 'User' })
 *     .id()
 *     .text('email')
 *     .searchable('email'),
 * );
 *
 * panel.autoNav();
 * ```
 */
export class AdminResource {
  readonly name: string;
  readonly label: string;
  readonly labelPlural: string;
  readonly icon?: string;
  private fieldDefs: AdminField[] = [];
  private filterDefs: AdminFilter[] = [];
  private actionDefs: AdminAction[] = [];
  private perPageCount = 25;
  private defaultSortField = "id";
  private defaultSortDir: "asc" | "desc" = "desc";
  private searchColumns: string[] = [];

  constructor(config: {
    name: string;
    label: string;
    labelPlural?: string;
    icon?: string;
  }) {
    this.name = config.name;
    this.label = config.label;
    this.labelPlural = config.labelPlural ?? `${config.label}s`;
    this.icon = config.icon;
  }

  // ── Fluent Field Builder ────────────────────────────────

  /**
   * @param {string} name
   * @param {FieldType} type
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  field(name: string, type: FieldType, label?: string): AdminFieldBuilder {
    const field: AdminField = {
      name,
      type,
      label: label ?? name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
      showOnIndex: true,
      showOnDetail: true,
      showOnCreate: true,
      showOnEdit: true,
    };
    this.fieldDefs.push(field);
    return new AdminFieldBuilder(field);
  }

  /**
   * @param {string} [name]
   * @returns {AdminFieldBuilder}
   */
  id(name = "id"): AdminFieldBuilder {
    return this.field(name, "number", "ID").sortable().hideOnCreate().hideOnEdit();
  }

  /**
   * @param {string} name
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  text(name: string, label?: string): AdminFieldBuilder {
    return this.field(name, "text", label).sortable().searchable();
  }
  /**
   * @param {string} name
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  textarea(name: string, label?: string): AdminFieldBuilder {
    return this.field(name, "textarea", label).hideOnIndex();
  }
  /**
   * @param {string} name
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  number(name: string, label?: string): AdminFieldBuilder {
    return this.field(name, "number", label).sortable();
  }
  /**
   * @param {string} name
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  email(name: string, label?: string): AdminFieldBuilder {
    return this.field(name, "email", label).sortable().searchable();
  }
  /**
   * @param {string} name
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  boolean(name: string, label?: string): AdminFieldBuilder {
    return this.field(name, "boolean", label).sortable().filterable();
  }
  /**
   * @param {string} name
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  date(name: string, label?: string): AdminFieldBuilder {
    return this.field(name, "date", label).sortable();
  }
  /**
   * @param {string} name
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  datetime(name: string, label?: string): AdminFieldBuilder {
    return this.field(name, "datetime", label).sortable();
  }
  /**
   * @param {string} name
   * @param {Array<{ label: string; value: string | number }>} options
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  select(
    name: string,
    options: Array<{ label: string; value: string | number }>,
    label?: string,
  ): AdminFieldBuilder {
    const builder = this.field(name, "select", label).filterable();
    builder.getField().options = options;
    return builder;
  }
  /**
   * @param {string} name
   * @param {string} relatedResource
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  belongsTo(name: string, relatedResource: string, label?: string): AdminFieldBuilder {
    const builder = this.field(name, "belongsTo", label);
    builder.getField().relatedResource = relatedResource;
    return builder;
  }
  /**
   * @param {string} name
   * @param {string} relatedResource
   * @param {string} [label]
   * @returns {AdminFieldBuilder}
   */
  hasMany(name: string, relatedResource: string, label?: string): AdminFieldBuilder {
    const builder = this.field(name, "hasMany", label).hideOnIndex().hideOnCreate().hideOnEdit();
    builder.getField().relatedResource = relatedResource;
    return builder;
  }
  /**
   * @param {string} name
   * @param {(record: Object} fn
   * @returns {AdminFieldBuilder}
   */
  computed(
    name: string,
    fn: (record: Record<string, unknown>) => unknown,
    label?: string,
  ): AdminFieldBuilder {
    const builder = this.field(name, "computed", label).hideOnCreate().hideOnEdit();
    builder.getField().computeFn = fn;
    return builder;
  }
  timestamps(): this {
    this.datetime("created_at", "Created").hideOnCreate().hideOnEdit();
    this.datetime("updated_at", "Updated").hideOnCreate().hideOnEdit();
    return this;
  }

  // ── Filters ─────────────────────────────────────────────

  /**
   * @param {AdminFilter} filter
   * @returns {this}
   */
  filter(filter: AdminFilter): this {
    this.filterDefs.push(filter);
    return this;
  }

  // ── Actions ─────────────────────────────────────────────

  /**
   * @param {AdminAction} action
   * @returns {this}
   */
  action(action: AdminAction): this {
    this.actionDefs.push(action);
    return this;
  }

  // ── Config ──────────────────────────────────────────────

  /**
   * @param {number} n
   * @returns {this}
   */
  perPage(n: number): this {
    this.perPageCount = n;
    return this;
  }
  /**
   * @param {string} field
   * @param {'asc' | 'desc'} [dir]
   * @returns {this}
   */
  defaultSort(field: string, dir: "asc" | "desc" = "desc"): this {
    this.defaultSortField = field;
    this.defaultSortDir = dir;
    return this;
  }
  /**
   * @param {string[]} ...columns
   * @returns {this}
   */
  search(...columns: string[]): this {
    this.searchColumns = columns;
    return this;
  }

  // ── Getters ─────────────────────────────────────────────

  getFields(): AdminField[] {
    return [...this.fieldDefs];
  }
  getIndexFields(): AdminField[] {
    return this.fieldDefs.filter((f) => f.showOnIndex);
  }
  getDetailFields(): AdminField[] {
    return this.fieldDefs.filter((f) => f.showOnDetail);
  }
  getCreateFields(): AdminField[] {
    return this.fieldDefs.filter((f) => f.showOnCreate);
  }
  getEditFields(): AdminField[] {
    return this.fieldDefs.filter((f) => f.showOnEdit);
  }
  getFilters(): AdminFilter[] {
    return [...this.filterDefs];
  }
  getActions(): AdminAction[] {
    return [...this.actionDefs];
  }
  getBulkActions(): AdminAction[] {
    return this.actionDefs.filter((a) => a.bulk);
  }
  getPerPage(): number {
    return this.perPageCount;
  }
  getDefaultSort(): { field: string; direction: "asc" | "desc" } {
    return { field: this.defaultSortField, direction: this.defaultSortDir };
  }
  getSearchColumns(): string[] {
    return [...this.searchColumns];
  }
  getSortableFields(): AdminField[] {
    return this.fieldDefs.filter((f) => f.sortable);
  }
  getFilterableFields(): AdminField[] {
    return this.fieldDefs.filter((f) => f.filterable);
  }
}

// ── Field Builder (fluent) ────────────────────────────────
