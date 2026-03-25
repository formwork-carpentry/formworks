/**
 * @module @carpentry/media/adapters
 * @description Document format adapters for {@link DocumentGenerator}.
 *
 * - {@link CsvDocumentAdapter} — CSV from rows/headers
 * - {@link HtmlDocumentAdapter} — HTML from templates
 * - {@link ArrayDocumentAdapter} — In-memory adapter for testing
 */

export { ArrayDocumentAdapter } from "./ArrayDocumentAdapter.js";
export { CsvDocumentAdapter } from "./CsvDocumentAdapter.js";
export { HtmlDocumentAdapter } from "./HtmlDocumentAdapter.js";
