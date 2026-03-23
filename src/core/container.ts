/**
 * @module @carpentry/core/container
 * @description IoC/DI container — dependency injection, binding, singletons, scoping, and decorators.
 *
 * @example
 * ```ts
 * import { Container } from './container';
 * import { Injectable, Inject } from './decorator';
 *
 * @Injectable()
 * class MyService {
 *   constructor(@Inject('logger') private logger) {}
 * }
 *
 * const container = new Container();
 * container.singleton(MyService);
 * const service = container.make(MyService);
 * ```
 */

export * from "./contracts/container/index.js";
export { Container } from "./container/Container.js";
