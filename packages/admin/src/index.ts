/**
 * @module @formwork/admin
 * @description Carpenter admin panel — resources, fields, and panel navigation.
 *
 * Use this package to define admin CRUD resources declaratively and build a dashboard
 * navigation structure with {@link AdminPanel}.
 *
 * @example
 * ```ts
 * import { AdminPanel, AdminResource } from '@formwork/admin';
 *
 * const users = new AdminResource({ name: 'users', label: 'User' })
 *   .id()
 *   .text('name')
 *   .email('email');
 *
 * const panel = new AdminPanel()
 *   .register(users)
 *   .autoNav()
 *   .setPath('/admin');
 *
 * const navigation = panel.getNavigation();
 * ```
 *
 * @see AdminPanel — Register resources and build navigation
 * @see AdminResource — Declare fields, filters, and actions
 */

export * from "./types.js";
export * from "./field-builder.js";
export * from "./resource.js";
export * from "./panel.js";
