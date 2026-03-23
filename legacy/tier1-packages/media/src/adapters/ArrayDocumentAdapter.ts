/**
 * @module @carpentry/media/adapters/ArrayDocumentAdapter
 * @description In-memory document adapter for testing.
 * @patterns Strategy, Test Double
 */

import type { DocumentFormat, DocumentTemplate, GeneratedDocument, IDocumentAdapter } from '../docgen.js';

/**
 * In-memory adapter that records generated documents as JSON payloads. Use for
 * testing that the generator was called with expected data, or when you need
 * a lightweight adapter without file I/O.
 *
 * @example
 * ```ts
 * const adapter = new ArrayDocumentAdapter('pdf');
 * await adapter.generate({ name: 'test', data: { x: 1 }, format: 'pdf' });
 *
 * const docs = adapter.getGenerated();
 * adapter.assertGenerated('test');
 * adapter.assertCount(1);
 * adapter.reset();
 * ```
 */
export class ArrayDocumentAdapter implements IDocumentAdapter {
  readonly format: DocumentFormat;
  private docs: GeneratedDocument[] = [];

  /**
   * @param format - Format this adapter claims to support (e.g. `'pdf'`, `'csv'`).
   */
  constructor(format: DocumentFormat) {
    this.format = format;
  }

  /**
   * Generate an in-memory document payload.
   *
   * @param template - Document template definition.
   * @returns Generated document.
   */
  async generate(template: DocumentTemplate): Promise<GeneratedDocument> {
    const mimeMap: Record<DocumentFormat, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      html: 'text/html',
      png: 'image/png',
      svg: 'image/svg+xml',
    };

    const document: GeneratedDocument = {
      buffer: Buffer.from(JSON.stringify({ template: template.name, data: template.data })),
      mimeType: mimeMap[this.format] ?? 'application/octet-stream',
      fileName: `${template.name}.${this.format}`,
      format: this.format,
      metadata: { generatedAt: new Date().toISOString(), options: template.options },
    };

    this.docs.push(document);
    return document;
  }

  /**
   * Get all documents generated so far.
   */
  getGenerated(): GeneratedDocument[] {
    return [...this.docs];
  }

  /**
   * Assert that at least one document was generated whose filename starts with the prefix.
   *
   * @param templateName - Template name prefix (e.g. `'report'` matches `report.pdf`).
   * @throws If no matching document found.
   */
  assertGenerated(templateName: string): void {
    if (!this.docs.some((document) => document.fileName.startsWith(templateName))) {
      throw new Error(`No ${this.format} document generated for template "${templateName}".`);
    }
  }

  /**
   * Assert the number of generated documents.
   *
   * @param count - Expected count.
   * @throws If count does not match.
   */
  assertCount(count: number): void {
    if (this.docs.length !== count) {
      throw new Error(`Expected ${count} ${this.format} documents, got ${this.docs.length}.`);
    }
  }

  /** Clear recorded documents. */
  reset(): void {
    this.docs = [];
  }
}
