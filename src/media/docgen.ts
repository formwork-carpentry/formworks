/**
 * @module @carpentry/media
 * @description DocumentGenerator — generate documents (CSV, HTML, etc.) from template data.
 * @patterns Abstract Factory, Strategy
 */

export type DocumentFormat = "pdf" | "docx" | "xlsx" | "csv" | "html" | "png" | "svg";

/**
 * Pluggable adapter that generates documents in a specific format.
 * Register adapters with {@link DocumentGenerator.registerAdapter}.
 */
export interface IDocumentAdapter {
  readonly format: DocumentFormat;
  generate(template: DocumentTemplate): Promise<GeneratedDocument>;
}

/** Template definition passed to an adapter. */
export interface DocumentTemplate {
  name: string;
  data: Record<string, unknown>;
  format: DocumentFormat;
  options?: DocumentOptions;
}

/** Layout options for PDF/DOCX generation. */
export interface DocumentOptions {
  pageSize?: "A4" | "letter" | "A3" | "legal";
  orientation?: "portrait" | "landscape";
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
  header?: string;
  footer?: string;
  styles?: Record<string, string>;
}

/** Result of document generation. */
export interface GeneratedDocument {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  format: DocumentFormat;
  metadata?: Record<string, unknown>;
}

/**
 * Generates documents from template data using registered format adapters.
 * Use {@link CsvDocumentAdapter} for CSV export, {@link HtmlDocumentAdapter} for HTML.
 *
 * @example
 * ```ts
 * const docGen = new DocumentGenerator();
 * docGen.registerAdapter(new CsvDocumentAdapter());
 *
 * const doc = await docGen.generate({
 *   name: 'media-catalog',
 *   data: {
 *     headers: ['id', 'name', 'size'],
 *     rows: items.map((i) => ({ id: i.id, name: i.name, size: i.size })),
 *   },
 *   format: 'csv',
 * });
 * // doc.buffer, doc.fileName === 'media-catalog.csv'
 * ```
 *
 * @example
 * ```ts
 * // Shorthand methods
 * const csv = await docGen.csv('export', { headers: ['a'], rows: [{ a: 1 }] });
 * ```
 */
export class DocumentGenerator {
  private adapters = new Map<DocumentFormat, IDocumentAdapter>();
  private generated: GeneratedDocument[] = [];

  /**
   * Register an adapter for a format. Overwrites existing adapter for that format.
   *
   * @param adapter - Adapter implementing IDocumentAdapter.
   * @returns `this` for chaining.
   */
  registerAdapter(adapter: IDocumentAdapter): this {
    this.adapters.set(adapter.format, adapter);
    return this;
  }

  /**
   * Generate a document from a template.
   *
   * @param template - Name, data, format, and optional options.
   * @returns Generated document buffer and metadata.
   * @throws {Error} When no adapter is registered for the requested format.
   *
   * @remarks
   * Register adapters with {@link DocumentGenerator.registerAdapter} before calling.
   */
  async generate(template: DocumentTemplate): Promise<GeneratedDocument> {
    const adapter = this.adapters.get(template.format);
    if (!adapter) {
      const available = [...this.adapters.keys()].join(", ");
      throw new Error(
        `No adapter for format "${template.format}". Available: ${available || "none"}`,
      );
    }

    const doc = await adapter.generate(template);
    this.generated.push(doc);
    return doc;
  }

  /** Shorthand: generate PDF. */
  pdf(
    name: string,
    data: Record<string, unknown>,
    options?: DocumentOptions,
  ): Promise<GeneratedDocument> {
    const template: DocumentTemplate = { name, data, format: "pdf" };
    if (options !== undefined) {
      template.options = options;
    }
    return this.generate(template);
  }

  /** Shorthand: generate DOCX. */
  docx(
    name: string,
    data: Record<string, unknown>,
    options?: DocumentOptions,
  ): Promise<GeneratedDocument> {
    const template: DocumentTemplate = { name, data, format: "docx" };
    if (options !== undefined) {
      template.options = options;
    }
    return this.generate(template);
  }

  /** Shorthand: generate XLSX. */
  xlsx(
    name: string,
    data: Record<string, unknown>,
    options?: DocumentOptions,
  ): Promise<GeneratedDocument> {
    const template: DocumentTemplate = { name, data, format: "xlsx" };
    if (options !== undefined) {
      template.options = options;
    }
    return this.generate(template);
  }

  /** Shorthand: generate CSV. */
  csv(name: string, data: Record<string, unknown>): Promise<GeneratedDocument> {
    return this.generate({ name, data, format: "csv" });
  }

  /** Get all generated documents (for testing). */
  getGenerated(): GeneratedDocument[] {
    return [...this.generated];
  }

  /** Clear generated history (for testing). */
  resetGenerated(): void {
    this.generated = [];
  }
}
