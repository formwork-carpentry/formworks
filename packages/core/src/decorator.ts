/**
 * @module @carpentry/core/decorator
 * @description Decorator utilities for dependency injection — @Injectable, @Inject, @Singleton, @Optional, etc.
 *
 * @example
 * ```ts
 * import { Injectable, Inject, Singleton, Optional, Named } from '@carpentry/core/decorator';
 *
 * @Injectable()
 * @Singleton()
 * class MyService {
 *   constructor(
 *     @Inject('logger') private logger,
 *     @Optional() private cache?: CacheService,
 *     @Named('elasticsearch') private search?: SearchService
 *   ) {}
 * }
 * ```
 */

export * from "./container/decorators.js";
