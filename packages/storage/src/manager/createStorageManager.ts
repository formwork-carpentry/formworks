import type { CarpenterFactoryAdapter } from "@formwork/core/adapters";
import type { IStorageAdapter } from "@formwork/core/contracts";
import { s3DriverFactory } from "@formwork/storage-s3";

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
