/**
 * @module @carpentry/foundation/providers/storage
 * @description Registers storage manager and default disk bindings.
 */

import type { ConfigResolver } from "@carpentry/formworks/core/config";
import type { IContainer } from "@carpentry/formworks/core/container";
import {
  type StorageDiskConfig,
  type StorageManager,
  createStorageManager,
} from "@carpentry/formworks/storage";

/**
 * @description Service provider that wires file storage services through IoC.
 */
export class StorageInfrastructureProvider {
  constructor(
    private readonly app: IContainer,
    private readonly resolver: ConfigResolver,
  ) {}

  /**
   * @description Registers storage manager and default disk.
   * @returns {void}
   */
  register(): void {
    this.app.singleton("storage.manager", () => {
      return createStorageManager(
        this.resolver.storageDisk(),
        this.resolver.storageDisks() as Record<string, StorageDiskConfig>,
      );
    });

    this.app.singleton("storage", (c) => (c.make("storage.manager") as StorageManager).disk());
  }
}
