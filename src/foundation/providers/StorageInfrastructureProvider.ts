import type { IContainer } from '@carpentry/formworks/core/container';
import { ConfigResolver } from '@carpentry/formworks/core/config';
import { createStorageManager, type StorageManager } from '@carpentry/formworks/storage';

export class StorageInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  register(): void {
    this.app.singleton('storage.manager', () => {
      return createStorageManager(this.resolver.storageDisk(), this.resolver.storageDisks() as any);
    });

    this.app.singleton('storage', (c) =>
      (c.make('storage.manager') as StorageManager).disk(),
    );
  }
}
