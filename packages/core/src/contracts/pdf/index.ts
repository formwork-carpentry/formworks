/**
 * @module @carpentry/core/contracts/pdf
 * @description PDF generation contract.
 */

export interface PdfOptions {
  format?: string | { width: string; height: string };
  landscape?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
}

export interface IPdfGenerator {
  generate(html: string, options?: PdfOptions): Promise<Buffer>;
  generateToFile(html: string, path: string, options?: PdfOptions): Promise<void>;
}
