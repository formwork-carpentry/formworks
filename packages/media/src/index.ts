/**
 * @module @carpentry/media
 * @description Media management — collections, transformations, document generation, and MIME utilities.
 *
 * Use this package to:
 * - Organize uploaded files into named collections (avatars, gallery, attachments)
 * - Chain transformations (resize, rename, convert) via pipelines
 * - Generate documents (CSV, HTML) from template data
 * - Work with MIME types and file sizes
 *
 * @example
 * ```ts
 * import {
 *   MediaCollection,
 *   DocumentGenerator,
 *   CsvDocumentAdapter,
 *   formatFileSize,
 * } from '@carpentry/media';
 *
 * const gallery = new MediaCollection('gallery');
 * gallery.add({ id: '1', name: 'Photo', fileName: 'photo.jpg', mimeType: 'image/jpeg', ... });
 *
 * const docGen = new DocumentGenerator();
 * docGen.registerAdapter(new CsvDocumentAdapter());
 * const csv = await docGen.generate({ name: 'export', data: { headers: ['id'], rows: [...] }, format: 'csv' });
 * ```
 *
 * @see {@link MediaCollection} — Group and filter media items
 * @see {@link TransformationPipeline} — Chain transformations
 * @see {@link DocumentGenerator} — Generate CSV, HTML, etc.
 * @see {@link formatFileSize} — Human-readable file sizes
 */

export * from './types.js';
export * from './collection.js';
export * from './pipeline.js';
export * from './docgen.js';
export * from './adapters/index.js';
export * from './mime.js';
