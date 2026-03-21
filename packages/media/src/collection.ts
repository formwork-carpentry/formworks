/**
 * @module @formwork/media
 * @description MediaCollection — filterable set of media items grouped by purpose.
 * @patterns Composite
 */

import type { MediaItem } from './types.js';

/**
 * A named collection of media items. Use collections to group files by purpose
 * (e.g. avatars, gallery, attachments) and filter by MIME type or custom predicates.
 *
 * @example
 * ```ts
 * const gallery = new MediaCollection('gallery');
 * gallery
 *   .add({ id: '1', name: 'Photo 1', fileName: 'a.jpg', mimeType: 'image/jpeg', ... })
 *   .add({ id: '2', name: 'Report', fileName: 'r.pdf', mimeType: 'application/pdf', ... });
 *
 * const images = gallery.images();      // JPEG, PNG, etc.
 * const docs = gallery.documents();     // PDF, DOCX, XLSX
 * const pngs = gallery.findByMime('image/png');
 * ```
 */
export class MediaCollection {
  private items: MediaItem[] = [];

  /**
   * @param name - Collection name (e.g. `hero`, `gallery`, `uploads`).
   */
  constructor(public readonly name: string) {}

  /**
   * Add a media item to the collection. Chainable.
   *
   * @param item - The media item to add.
   * @returns `this` for chaining.
   *
   * @example
   * ```ts
   * collection.add(item).add(anotherItem);
   * ```
   */
  add(item: MediaItem): this {
    this.items.push(item);
    return this;
  }

  /** Returns a copy of all items. */
  all(): MediaItem[] { return [...this.items]; }

  /** First item or null if empty. */
  first(): MediaItem | null { return this.items[0] ?? null; }

  /** Last item or null if empty. */
  last(): MediaItem | null { return this.items[this.items.length - 1] ?? null; }

  /** Number of items in the collection. */
  count(): number { return this.items.length; }

  /**
   * Filter items by a predicate.
   *
   * @param predicate - Function returning true for items to keep.
   * @returns Filtered array of items.
   *
   * @example
   * ```ts
   * const large = collection.filter((i) => i.size > 1_000_000);
   * const pngs = collection.filter((i) => i.mimeType === 'image/png');
   * ```
   */
  filter(predicate: (item: MediaItem) => boolean): MediaItem[] {
    return this.items.filter(predicate);
  }

  /**
   * Find items whose MIME type starts with the given prefix.
   *
   * @param mime - MIME prefix (e.g. `image/` for all images, `application/pdf` for PDFs).
   * @returns Matching items.
   *
   * @example
   * ```ts
   * collection.findByMime('image/');        // All images
   * collection.findByMime('application/pdf'); // PDFs only
   * ```
   */
  findByMime(mime: string): MediaItem[] {
    return this.items.filter((i) => i.mimeType.startsWith(mime));
  }

  /** Items with image MIME types (jpeg, png, gif, webp, etc.). */
  images(): MediaItem[] { return this.findByMime('image/'); }

  /** Items that are PDFs or Office documents (docx, xlsx, pptx). */
  documents(): MediaItem[] {
    return this.items.filter((i) =>
      i.mimeType.includes('pdf') || i.mimeType.includes('document') ||
      i.mimeType.includes('spreadsheet') || i.mimeType.includes('presentation')
    );
  }

  /**
   * Remove an item by id.
   *
   * @param id - The item id to remove.
   * @returns `true` if removed, `false` if not found.
   */
  remove(id: string): boolean {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    return true;
  }

  /** Remove all items from the collection. */
  clear(): void { this.items = []; }

  /** Serialize to JSON (returns array of items). */
  toJSON(): MediaItem[] { return this.all(); }
}
