/**
 * @module @carpentry/excel
 * @description Spreadsheet generation and parsing — ExcelJS/SheetJS under the hood.
 *
 * Used for data exports, bulk imports, report generation, and template rendering.
 * Driver-based: swap between ExcelJS (full .xlsx), csv-parse (CSV only),
 * or SheetJS (broader format support).
 *
 * @patterns Strategy (spreadsheet drivers), Builder (fluent sheet/row API)
 * @principles OCP — add drivers without modifying core; DIP — depend on ISpreadsheet
 *
 * @example
 * ```ts
 * import { SpreadsheetBuilder } from '@carpentry/excel';
 *
 * const buffer = await SpreadsheetBuilder.create()
 *   .sheet('Users')
 *     .columns(['Name', 'Email', 'Created'])
 *     .row(['Alice', 'alice@example.com', '2026-01-15'])
 *     .row(['Bob',   'bob@example.com',   '2026-02-20'])
 *   .build('xlsx');
 *
 * // Parse an uploaded file
 * import { SpreadsheetReader } from '@carpentry/excel';
 * const rows = await SpreadsheetReader.fromBuffer(uploaded, 'csv');
 * ```
 */

// ── Types ─────────────────────────────────────────────────

export type SpreadsheetFormat = 'xlsx' | 'csv' | 'tsv';

export interface SheetData {
  name: string;
  columns: string[];
  rows: unknown[][];
}

export interface ISpreadsheet {
  /** Generate spreadsheet buffer from sheet data. */
  generate(sheets: SheetData[], format: SpreadsheetFormat): Promise<Buffer>;
  /** Parse spreadsheet buffer into sheet data. */
  parse(buffer: Buffer, format: SpreadsheetFormat): Promise<SheetData[]>;
}

// ── Fluent Builder ────────────────────────────────────────

class SheetBuilder {
  private _columns: string[] = [];
  private _rows: unknown[][] = [];

  constructor(
    private _name: string,
    private parent: SpreadsheetBuilder,
  ) {}

  columns(cols: string[]): this {
    this._columns = cols;
    return this;
  }

  row(data: unknown[]): this {
    this._rows.push(data);
    return this;
  }

  rows(data: unknown[][]): this {
    this._rows.push(...data);
    return this;
  }

  /** Add another sheet. */
  sheet(name: string): SheetBuilder {
    return this.parent.sheet(name);
  }

  /** Build the spreadsheet. */
  build(format: SpreadsheetFormat = 'xlsx'): Promise<Buffer> {
    return this.parent.build(format);
  }

  toData(): SheetData {
    return { name: this._name, columns: this._columns, rows: this._rows };
  }
}

export class SpreadsheetBuilder {
  private sheets: SheetBuilder[] = [];
  private driver: ISpreadsheet;

  private constructor(driver?: ISpreadsheet) {
    this.driver = driver ?? new CsvDriver();
  }

  static create(driver?: ISpreadsheet): SpreadsheetBuilder {
    return new SpreadsheetBuilder(driver);
  }

  /** Use a different driver. */
  using(driver: ISpreadsheet): this {
    this.driver = driver;
    return this;
  }

  sheet(name: string): SheetBuilder {
    const sb = new SheetBuilder(name, this);
    this.sheets.push(sb);
    return sb;
  }

  async build(format: SpreadsheetFormat = 'xlsx'): Promise<Buffer> {
    const data = this.sheets.map(s => s.toData());
    return this.driver.generate(data, format);
  }
}

// ── Reader ────────────────────────────────────────────────

export class SpreadsheetReader {
  private constructor(private driver: ISpreadsheet) {}

  static create(driver?: ISpreadsheet): SpreadsheetReader {
    return new SpreadsheetReader(driver ?? new CsvDriver());
  }

  static async fromBuffer(
    buffer: Buffer,
    format: SpreadsheetFormat = 'csv',
    driver?: ISpreadsheet,
  ): Promise<SheetData[]> {
    return SpreadsheetReader.create(driver).parse(buffer, format);
  }

  async parse(buffer: Buffer, format: SpreadsheetFormat): Promise<SheetData[]> {
    return this.driver.parse(buffer, format);
  }
}

// ── Built-in CSV Driver ───────────────────────────────────

/** Minimal CSV driver — no external dependencies. */
class CsvDriver implements ISpreadsheet {
  async generate(sheets: SheetData[], _format: SpreadsheetFormat): Promise<Buffer> {
    // For CSV, only the first sheet is used
    const sheet = sheets[0];
    if (!sheet) return Buffer.from('');
    const sep = _format === 'tsv' ? '\t' : ',';
    const lines: string[] = [];

    if (sheet.columns.length > 0) {
      lines.push(sheet.columns.map(c => this.escapeField(String(c), sep)).join(sep));
    }

    for (const row of sheet.rows) {
      lines.push(row.map(cell => this.escapeField(String(cell ?? ''), sep)).join(sep));
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  async parse(buffer: Buffer, _format: SpreadsheetFormat): Promise<SheetData[]> {
    const text = buffer.toString('utf-8');
    const sep = _format === 'tsv' ? '\t' : ',';
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    if (lines.length === 0) return [{ name: 'Sheet1', columns: [], rows: [] }];

    const columns = this.parseLine(lines[0], sep);
    const rows = lines.slice(1).map(line => this.parseLine(line, sep));

    return [{ name: 'Sheet1', columns, rows }];
  }

  private escapeField(value: string, sep: string): string {
    if (value.includes(sep) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private parseLine(line: string, sep: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === sep) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(current);
    return fields;
  }
}
