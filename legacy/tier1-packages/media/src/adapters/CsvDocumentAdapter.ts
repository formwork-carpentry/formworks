/**
 * @module @carpentry/media/adapters/CsvDocumentAdapter
 * @description CSV document generation adapter.
 * @patterns Strategy (format-specific generation)
 */

import type { DocumentFormat, DocumentTemplate, GeneratedDocument, IDocumentAdapter } from '../docgen.js';

/**
 * Generates CSV documents from template data. Expects `data.rows` (array of objects)
 * and optional `data.headers` (column order). Escapes commas and quotes in values.
 *
 * @example
 * ```ts
 * const adapter = new CsvDocumentAdapter();
 * const doc = await adapter.generate({
 *   name: 'export',
 *   data: {
 *     headers: ['id', 'name', 'size'],
 *     rows: [
 *       { id: '1', name: 'Photo', size: '256 KB' },
 *       { id: '2', name: 'Report', size: '1.2 MB' },
 *     ],
 *   },
 *   format: 'csv',
 * });
 * // doc.fileName === 'export.csv', doc.buffer contains CSV
 * ```
 */
export class CsvDocumentAdapter implements IDocumentAdapter {
  readonly format: DocumentFormat = 'csv';

  /**
   * @param template - Must include `data.rows` (array of objects). `data.headers` optional.
   * @returns CSV buffer and metadata.
   * @throws {Error} When `data.rows` is missing or not an array.
   *
   * @see {@link DocumentGenerator} — Register and use this adapter
   */
  async generate(template: DocumentTemplate): Promise<GeneratedDocument> {
    const rows = template.data['rows'] as Record<string, unknown>[] | undefined;
    const headers = template.data['headers'] as string[] | undefined;

    if (!rows || !Array.isArray(rows)) {
      throw new Error('CSV template requires data.rows (array of objects).');
    }

    const columns = headers ?? Object.keys(rows[0] ?? {});
    const lines = [
      columns.join(','),
      ...rows.map((row) =>
        columns.map((column) => {
          const value = String(row[column] ?? '');
          return value.includes(',') || value.includes('"') || value.includes('\n')
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(',')
      ),
    ];

    return {
      buffer: Buffer.from(lines.join('\n'), 'utf-8'),
      mimeType: 'text/csv',
      fileName: `${template.name}.csv`,
      format: 'csv',
    };
  }
}
