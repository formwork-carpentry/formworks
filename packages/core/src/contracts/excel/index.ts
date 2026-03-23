/**
 * @module @carpentry/core/contracts/excel
 * @description Spreadsheet generation and parsing contract.
 */

export type SpreadsheetFormat = 'xlsx' | 'csv' | 'tsv';

export interface SheetData {
  name: string;
  columns: string[];
  rows: unknown[][];
}

export interface ISpreadsheet {
  generate(sheets: SheetData[], format: SpreadsheetFormat): Promise<Buffer>;
  parse(buffer: Buffer, format: SpreadsheetFormat): Promise<SheetData[]>;
}
