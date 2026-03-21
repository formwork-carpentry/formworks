/**
 * @module @formwork/admin
 * @description AdminFieldBuilder — fluent builder for admin field configuration
 * @patterns Builder
 */

import type { AdminField } from "./types.js";

/**
 * AdminFieldBuilder — fluent builder for configuring a single admin field.
 *
 * Returned by methods on {@link AdminResource} (e.g. `resource.text('name')`).
 * Use it to toggle flags like `sortable()`, `searchable()`, and visibility helpers.
 *
 * @example
 * ```ts
 * const posts = new AdminResource({ name: 'posts', label: 'Post' })
 *   .text('title')
 *   .sortable()
 *   .searchable()
 *   .help('Shown on the create/edit forms');
 * ```
 */
export class AdminFieldBuilder {
  constructor(private field: AdminField) {}

  getField(): AdminField {
    return this.field;
  }

  required(): this {
    this.field.required = true;
    return this;
  }
  sortable(): this {
    this.field.sortable = true;
    return this;
  }
  searchable(): this {
    this.field.searchable = true;
    return this;
  }
  filterable(): this {
    this.field.filterable = true;
    return this;
  }
  hideOnIndex(): this {
    this.field.showOnIndex = false;
    return this;
  }
  hideOnDetail(): this {
    this.field.showOnDetail = false;
    return this;
  }
  hideOnCreate(): this {
    this.field.showOnCreate = false;
    return this;
  }
  hideOnEdit(): this {
    this.field.showOnEdit = false;
    return this;
  }
  /**
   * @param {string} text
   * @returns {this}
   */
  help(text: string): this {
    this.field.helpText = text;
    return this;
  }
  /**
   * @param {unknown} value
   * @returns {this}
   */
  default(value: unknown): this {
    this.field.defaultValue = value;
    return this;
  }
  /**
   * @param {string} rules
   * @returns {this}
   */
  rules(rules: string): this {
    this.field.rules = rules;
    return this;
  }
}
