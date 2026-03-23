/**
 * @module @carpentry/core/application
 * @description Application lifecycle — bootstrap, service provider registration, and app shutdown.
 *
 * @example
 * ```ts
 * import { Application } from '@carpentry/core/application';
 *
 * const app = Application.create('my-app');
 * app.register(MyServiceProvider);
 * await app.boot();
 *
 * app.terminate();
 * ```
 */

export { Application } from "./application/Application.js";
export type { AppConfig } from "./application/Application.js";
