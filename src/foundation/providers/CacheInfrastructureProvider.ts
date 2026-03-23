import type { IContainer } from '@carpentry/formworks/core/container';
import { ConfigResolver } from '@carpentry/formworks/core/config';
import { createCacheManager, type CacheManager } from '@carpentry/formworks/cache';

export class CacheInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  register(): void {
    this.app.singleton('cache.manager', () => {
      return createCacheManager(
        this.resolver.cacheDriver(),
        this.resolver.cacheStores() as Record<string, { driver: string }>,
      );
    });

    this.app.singleton('cache', (c) =>
      (c.make('cache.manager') as CacheManager).store(),
    );
  }
}
