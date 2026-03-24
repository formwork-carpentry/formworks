/**
 * @module @carpentry/foundation/providers/cache
 * @description Registers cache manager and default cache store bindings.
 */

import type { IContainer } from '@carpentry/formworks/core/container';
import { ConfigResolver } from '@carpentry/formworks/core/config';
import {
  createCacheManager,
  type CacheDriverConfig,
  type CacheManager,
} from '@carpentry/formworks/cache';

/**
 * @description Service provider that wires cache services through the IoC container.
 */
export class CacheInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  /**
   * @description Registers cache manager and default cache store.
   * @returns {void}
   */
  register(): void {
    this.app.singleton('cache.manager', () => {
      return createCacheManager(
        this.resolver.cacheDriver(),
        this.resolver.cacheStores() as Record<string, CacheDriverConfig>,
      );
    });

    this.app.singleton('cache', (c) =>
      (c.make('cache.manager') as CacheManager).store(),
    );
  }
}
