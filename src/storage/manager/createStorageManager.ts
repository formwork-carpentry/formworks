import type { CarpenterFactoryAdapter } from "@carpentry/formworks/adapters";
import type { IStorageAdapter } from "@carpentry/formworks/contracts";
import { s3DriverFactory } from "@carpentry/storage-s3";

import { LocalStorageAdapter } from "../adapters/LocalStorageAdapter.js";
import { type StorageDiskConfig, StorageManager } from "./StorageManager.js";

export function createStorageManager(
  defaultDisk: string,
  configs: Record<string, StorageDiskConfig>,
): StorageManager {
  const manager = new StorageManager(defaultDisk, configs);
  manager.registerDriver(
    "local",
    (cfg) =>
      new LocalStorageAdapter({
        root: ((cfg as Record<string, unknown>).root as string) ?? "storage/app",
        baseUrl: (cfg as Record<string, unknown>).url as string,
      }),
  );
  manager.registerDriver(
    "s3",
    s3DriverFactory as CarpenterFactoryAdapter<StorageDiskConfig, IStorageAdapter>,
  );
  return manager;
}
