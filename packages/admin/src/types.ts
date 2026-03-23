/**
 * @module @carpentry/admin
 * @description Admin types, field definitions, filters, actions
 */

/**
 * @module @carpentry/admin
 * @description Admin panel — resource-based CRUD, dashboard widgets, navigation, bulk actions
 *
 * Architecture:
 *   AdminResource defines a model's admin interface (fields, filters, actions, validations)
 *   AdminPanel registers resources, builds navigation, resolves dashboard
 *   Field types (text, number, select, boolean, date, relation, etc.) are pluggable
 *
 * @patterns Registry (resources), Builder (field/filter/action), Template Method (AdminResource),
 *           Strategy (field types), Composite (navigation groups)
 * @principles OCP — new field types/actions without modifying core
 *             SRP — resource definition separate from rendering
 */

// ── Field Types ───────────────────────────────────────────

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "password"
  | "url"
  | "select"
  | "multiselect"
  | "boolean"
  | "date"
  | "datetime"
  | "file"
  | "image"
  | "json"
  | "color"
  | "slug"
  | "belongsTo"
  | "hasMany"
  | "belongsToMany"
  | "hidden"
  | "computed";

export interface AdminField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  /** Show on index/list page */
  showOnIndex?: boolean;
  /** Show on detail page */
  showOnDetail?: boolean;
  /** Show on create form */
  showOnCreate?: boolean;
  /** Show on edit form */
  showOnEdit?: boolean;
  /** Select/multiselect options */
  options?: Array<{ label: string; value: string | number }>;
  /** Relation resource name */
  relatedResource?: string;
  /** Validation rules (string format) */
  rules?: string;
  /** Help text shown below the field */
  helpText?: string;
  /** Default value */
  defaultValue?: unknown;
  /** Computed value function (for computed fields) */
  computeFn?: (record: Record<string, unknown>) => unknown;
}

// ── Filters ───────────────────────────────────────────────

export interface AdminFilter {
  name: string;
  label: string;
  type: "select" | "boolean" | "date-range" | "text";
  options?: Array<{ label: string; value: string | number }>;
  apply: (query: unknown, value: unknown) => unknown;
}

// ── Actions ───────────────────────────────────────────────

export interface AdminAction {
  name: string;
  label: string;
  /** Confirmation message (null = no confirmation needed) */
  confirmMessage?: string;
  /** Can this action run on multiple records? */
  bulk?: boolean;
  /** Icon name */
  icon?: string;
  /** Destructive action? (shows red in UI) */
  destructive?: boolean;
  handler: (
    records: Record<string, unknown>[],
    context: AdminActionContext,
  ) => Promise<AdminActionResult>;
}

export interface AdminActionContext {
  userId?: string | number;
  [key: string]: unknown;
}

export interface AdminActionResult {
  success: boolean;
  message: string;
  redirect?: string;
}

// ── Dashboard Widget ──────────────────────────────────────

export type WidgetType = "stat" | "chart" | "table" | "list" | "custom";

export interface DashboardWidget {
  name: string;
  label: string;
  type: WidgetType;
  /** Grid width (1-12) */
  width?: number;
  /** Fetch data for this widget */
  resolve: () => Promise<unknown>;
}

// ── Navigation ────────────────────────────────────────────

export interface NavItem {
  label: string;
  icon?: string;
  route?: string;
  resource?: string;
  children?: NavItem[];
  badge?: () => Promise<number | string | null>;
}

// ── Admin Resource ────────────────────────────────────────
