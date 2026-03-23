/**
 * @module @carpentry/pdf
 * @description Server-side PDF generation — invoices, reports, certificates.
 *
 * Driver-based architecture: swap between Puppeteer (headless Chrome),
 * Playwright, or library-based generators without changing application code.
 *
 * @patterns Strategy (PDF drivers), Factory (PdfManager.driver())
 * @principles OCP — add drivers without modifying core; DIP — depend on IPdfGenerator
 *
 * @example
 * ```ts
 * import { PdfManager } from '@carpentry/pdf';
 *
 * const pdf = new PdfManager({ driver: 'html' });
 * const buffer = await pdf.generate('<h1>Invoice #42</h1>');
 * await pdf.generateToFile('<h1>Report</h1>', '/tmp/report.pdf');
 * ```
 */

// ── Contract ──────────────────────────────────────────────

export interface IPdfGenerator {
  /** Generate PDF from HTML string. Returns raw PDF bytes. */
  generate(html: string, options?: PdfOptions): Promise<Buffer>;
  /** Generate PDF and write to file path. */
  generateToFile(html: string, path: string, options?: PdfOptions): Promise<void>;
}

export interface PdfOptions {
  /** Page format: 'A4' | 'Letter' | 'Legal' | { width: string; height: string } */
  format?: string | { width: string; height: string };
  /** Landscape orientation. Default: false */
  landscape?: boolean;
  /** Page margins in CSS units (e.g. '1cm', '0.5in'). */
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  /** HTML header template (Chromium-based drivers). */
  headerTemplate?: string;
  /** HTML footer template (Chromium-based drivers). */
  footerTemplate?: string;
  /** Print background graphics. Default: true */
  printBackground?: boolean;
}

export interface PdfConfig {
  driver: string;
  /** Puppeteer/Playwright launch options */
  browserOptions?: Record<string, unknown>;
}

// ── PDF Manager ───────────────────────────────────────────

export class PdfManager implements IPdfGenerator {
  private drivers = new Map<string, IPdfGenerator>();
  private defaultDriver: string;

  constructor(config: PdfConfig) {
    this.defaultDriver = config.driver;
    // Register built-in HTML driver (simple template-based, no browser)
    this.registerDriver('html', new HtmlPdfDriver());
  }

  registerDriver(name: string, driver: IPdfGenerator): void {
    this.drivers.set(name, driver);
  }

  driver(name?: string): IPdfGenerator {
    const d = this.drivers.get(name ?? this.defaultDriver);
    if (!d) throw new Error(`PDF driver "${name ?? this.defaultDriver}" not registered.`);
    return d;
  }

  async generate(html: string, options?: PdfOptions): Promise<Buffer> {
    return this.driver().generate(html, options);
  }

  async generateToFile(html: string, path: string, options?: PdfOptions): Promise<void> {
    return this.driver().generateToFile(html, path, options);
  }
}

// ── Built-in HTML Driver (stub — real impl needs browser or lib) ──

/**
 * Minimal HTML-to-PDF driver. In production, register a Puppeteer or
 * Playwright driver for full CSS/JS rendering support.
 *
 * This stub stores raw HTML as a Buffer for testing and development.
 */
class HtmlPdfDriver implements IPdfGenerator {
  async generate(html: string, _options?: PdfOptions): Promise<Buffer> {
    // Stub: wrap HTML in a minimal PDF-like structure for testing
    // Real implementations should use puppeteer.page.pdf() or similar
    return Buffer.from(html, 'utf-8');
  }

  async generateToFile(html: string, path: string, options?: PdfOptions): Promise<void> {
    const { writeFile } = await import('node:fs/promises');
    const buffer = await this.generate(html, options);
    await writeFile(path, buffer);
  }
}
