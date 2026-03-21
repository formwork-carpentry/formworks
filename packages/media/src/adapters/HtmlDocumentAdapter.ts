/**
 * @module @formwork/media/adapters/HtmlDocumentAdapter
 * @description HTML document generation adapter.
 * @patterns Strategy (format-specific generation)
 */

import type { DocumentFormat, DocumentTemplate, GeneratedDocument, IDocumentAdapter } from '../docgen.js';

/**
 * Generates HTML documents. Register custom templates via `registerTemplate`, or
 * use the default JSON fallback when no template matches.
 *
 * @example
 * ```ts
 * const adapter = new HtmlDocumentAdapter();
 * adapter.registerTemplate('report', (data) =>
 *   `<html><body><h1>${data.title}</h1><p>${data.content}</p></body></html>`
 * );
 *
 * const doc = await adapter.generate({
 *   name: 'report',
 *   data: { title: 'Report', content: 'Hello' },
 *   format: 'html',
 * });
 * ```
 */
export class HtmlDocumentAdapter implements IDocumentAdapter {
  readonly format: DocumentFormat = 'html';
  private templateFns = new Map<string, (data: Record<string, unknown>) => string>();

  /**
   * Register a template renderer. When `generate` is called with a matching name,
   * this function receives `template.data` and returns HTML.
   *
   * @param name - Template name (matched to `DocumentTemplate.name`).
   * @param fn - Function that returns HTML string from data.
   * @returns `this` for chaining.
   */
  registerTemplate(name: string, fn: (data: Record<string, unknown>) => string): this {
    this.templateFns.set(name, fn);
    return this;
  }

  /**
   * Generate HTML. Uses registered template if name matches, otherwise JSON fallback.
   */
  async generate(template: DocumentTemplate): Promise<GeneratedDocument> {
    const renderer = this.templateFns.get(template.name);
    const html = renderer
      ? renderer(template.data)
      : `<html><body><pre>${JSON.stringify(template.data, null, 2)}</pre></body></html>`;

    return {
      buffer: Buffer.from(html, 'utf-8'),
      mimeType: 'text/html',
      fileName: `${template.name}.html`,
      format: 'html',
    };
  }
}
