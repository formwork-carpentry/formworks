/**
 * @module @formwork/core/contracts/storage
 * @description File storage contract - all storage adapters implement this interface.
 *
 * Implementations: MemoryStorageAdapter, LocalStorageAdapter, S3StorageAdapter
 *
 * @example
 * ```ts
 * const storage = container.make<IStorageAdapter>('storage');
 * await storage.put('uploads/photo.jpg', imageBuffer, 'image/jpeg');
 * const url = storage.url('uploads/photo.jpg');
 * ```
 */
export {};
//# sourceMappingURL=index.js.map