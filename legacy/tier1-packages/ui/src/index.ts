/**
 * @module @carpentry/ui
 * @description UI bridge — islands architecture, SSR shells, and framework-agnostic helpers.
 *
 * Use this package to build "island" pages:
 * - Render mostly-static HTML on the server
 * - Hydrate only interactive parts with {@link IslandRenderer}
 * - Keep a framework-agnostic API by using island definitions ({@link Island}) and shared
 *   form helpers (`useForm`)
 *
 * @example
 * ```ts
 * import { Island, IslandRenderer, useForm } from '@carpentry/ui';
 *
 * const Counter = Island({
 *   name: 'Counter',
 *   render: (props: { initial: number }) =>
 *     `<button>Count: ${props.initial}</button>`,
 *   hydrate: 'lazy',
 *   clientEntry: '/islands/Counter.js',
 * });
 *
 * const renderer = new IslandRenderer();
 * const html = renderer.renderPage(`
 *   <h1>Dashboard</h1>
 *   ${renderer.island(Counter, { initial: 0 })}
 * `);
 * // html contains <carpenter-island> wrappers + a loader script
 * ```
 *
 * @see Island — Define an island component
 * @see IslandRenderer — Render pages with island wrappers
 * @see useForm — Form state helper for client-side interactivity
 */

export * from "./types.js";
export * from "./manager.js";
export * from "./components.js";

export { Island, IslandRenderer } from "./Islands.js";
export type { IslandDefinition, RenderedIsland, HydrationStrategy } from "./Islands.js";
export { useForm } from "./FormHelper.js";
export type { FormState, FormErrors, SubmitResult, SubmitOptions } from "./FormHelper.js";
