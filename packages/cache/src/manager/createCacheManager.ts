import { FileCacheStore } from "../adapters/FileCacheStore.js";
import { CacheManager, type CacheStoreConfig } from "./CacheManager.js";

export function createCacheManager(
  defaultStore: string,
  configs: Record<string, CacheStoreConfig>,
): CacheManager {
  const manager = new CacheManager(defaultStore, configs);
  manager.registerDriver(
    "file",
    (cfg) =>
      new FileCacheStore({
        directory: ((cfg as Record<string, unknown>).path as string) ?? "storage/cache",
      }),
  );
  return manager;
}
