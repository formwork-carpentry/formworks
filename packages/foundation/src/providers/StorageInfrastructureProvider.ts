import type { IContainer } from '@formwork/core/container';
import { ConfigResolver } from '@formwork/core/config';
import { createStorageManager, type StorageManager } from '@formwork/storage';

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
