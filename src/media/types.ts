/**
 * @module @carpentry/media
 * @description Core types for media handling — MediaItem and related interfaces.
 */

/**
 * Represents a single media file with metadata, storage location, and optional derived variants.
 *
 * Use this interface when adding items to a {@link MediaCollection} or when working with
 * uploaded files from storage. The `metadata` field can hold app-specific data (e.g. `url` for
 * public URLs, `alt` for accessibility).
 *
 * @example
 * ```ts
 * const item: MediaItem = {
 *   id: 'uploads/photo-123.jpg',
 *   name: 'Profile photo',
 *   fileName: 'photo-123.jpg',
 *   mimeType: 'image/jpeg',
 *   size: 256_000,
 *   path: 'uploads/photo-123.jpg',
 *   disk: 'local',
 *   collection: 'avatars',
 *   metadata: { url: '/storage/uploads/photo-123.jpg' },
 *   createdAt: new Date(),
 * };
 * collection.add(item);
 * ```
 */
export interface MediaItem {
  /** Unique identifier (often the storage path). */
  id: string;
  /** Display or logical name. */
  name: string;
  /** Original filename including extension. */
  fileName: string;
  /** MIME type (e.g. `image/jpeg`, `application/pdf`). */
  mimeType: string;
  /** File size in bytes. */
  size: number;
  /** Storage path on the disk. */
  path: string;
  /** Disk name from storage config (e.g. `local`, `s3`). */
  disk: string;
  /** Collection name this item belongs to. */
  collection: string;
  /** Extra data (url, alt text, dimensions, etc.). */
  metadata: Record<string, unknown>;
  /** When the file was added. */
  createdAt: Date;
  /** Map of transformation name → output path (e.g. `{ thumb: 'uploads/photo-123-thumb.jpg' }`). */
  transformations?: Record<string, string>;
}
