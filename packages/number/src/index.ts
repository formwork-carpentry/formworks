/**
 * @module @carpentry/number
 * @description Currency-aware arithmetic, Money value objects, number formatting.
 *
 * Uses integer minor units (cents) internally to avoid floating-point errors.
 * All arithmetic operations return new Money instances (immutable value objects).
 *
 * @patterns Value Object (Money is immutable), Factory (Money.of)
 * @principles SRP — numeric/monetary concerns only; no side effects
 *
 * @example
 * ```ts
 * import { Money, Currency } from '@carpentry/number';
 *
 * const price = Money.of(1999, 'USD');        // $19.99
 * const tax = price.multiply(0.08);            // $1.60
 * const total = price.add(tax);                // $21.59
 * console.log(total.format());                 // "$21.59"
 * console.log(total.cents);                    // 2159
 * ```
 */

// ── Currency Registry ─────────────────────────────────────

export interface CurrencyDef {
  code: string;
  symbol: string;
  /** Number of decimal places (2 for USD/EUR, 0 for JPY, 3 for KWD) */
  precision: number;
  /** Thousands separator */
  thousandsSep: string;
  /** Decimal separator */
  decimalSep: string;
}

const CURRENCIES: Record<string, CurrencyDef> = {
  USD: { code: 'USD', symbol: '$',  precision: 2, thousandsSep: ',', decimalSep: '.' },
  EUR: { code: 'EUR', symbol: '€',  precision: 2, thousandsSep: '.', decimalSep: ',' },
  GBP: { code: 'GBP', symbol: '£',  precision: 2, thousandsSep: ',', decimalSep: '.' },
  JPY: { code: 'JPY', symbol: '¥',  precision: 0, thousandsSep: ',', decimalSep: '.' },
  KWD: { code: 'KWD', symbol: 'د.ك', precision: 3, thousandsSep: ',', decimalSep: '.' },
  CHF: { code: 'CHF', symbol: 'CHF', precision: 2, thousandsSep: "'", decimalSep: '.' },
  CAD: { code: 'CAD', symbol: 'CA$', precision: 2, thousandsSep: ',', decimalSep: '.' },
  AUD: { code: 'AUD', symbol: 'A$',  precision: 2, thousandsSep: ',', decimalSep: '.' },
  CNY: { code: 'CNY', symbol: '¥',  precision: 2, thousandsSep: ',', decimalSep: '.' },
  INR: { code: 'INR', symbol: '₹',  precision: 2, thousandsSep: ',', decimalSep: '.' },
  BRL: { code: 'BRL', symbol: 'R$', precision: 2, thousandsSep: '.', decimalSep: ',' },
  ZAR: { code: 'ZAR', symbol: 'R',  precision: 2, thousandsSep: ',', decimalSep: '.' },
};

export class Currency {
  private constructor(public readonly def: CurrencyDef) {}

  static of(code: string): Currency {
    const upper = code.toUpperCase();
    const def = CURRENCIES[upper];
    if (!def) throw new Error(`Unknown currency: ${code}. Register it with Currency.register().`);
    return new Currency(def);
  }

  static register(def: CurrencyDef): void {
    CURRENCIES[def.code.toUpperCase()] = def;
  }

  get code(): string { return this.def.code; }
  get symbol(): string { return this.def.symbol; }
  get precision(): number { return this.def.precision; }
}

// ── Money Value Object ────────────────────────────────────

export type RoundingMode = 'round' | 'ceil' | 'floor' | 'trunc';

export class Money {
  /** Amount in minor units (cents for USD, integer yen for JPY). */
  readonly cents: number;
  readonly currency: Currency;

  private constructor(cents: number, currency: Currency) {
    if (!Number.isFinite(cents)) throw new Error('Money amount must be finite');
    this.cents = Math.round(cents); // always integer minor units
    this.currency = currency;
  }

  /** Create from minor units (cents). */
  static of(cents: number, currencyCode: string): Money {
    return new Money(cents, Currency.of(currencyCode));
  }

  /** Create from a major-unit amount (e.g. 19.99 USD → 1999 cents). */
  static fromDecimal(amount: number, currencyCode: string): Money {
    const cur = Currency.of(currencyCode);
    const factor = 10 ** cur.precision;
    return new Money(Math.round(amount * factor), cur);
  }

  /** Parse a string like "19.99" into Money. */
  static parse(value: string, currencyCode: string): Money {
    const cleaned = value.replace(/[^0-9.\-]/g, '');
    return Money.fromDecimal(Number.parseFloat(cleaned), currencyCode);
  }

  /** Zero amount in the given currency. */
  static zero(currencyCode: string): Money {
    return new Money(0, Currency.of(currencyCode));
  }

  // ── Arithmetic (all return new Money) ───────────────────

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents - other.cents, this.currency);
  }

  multiply(factor: number, rounding: RoundingMode = 'round'): Money {
    return new Money(this.applyRounding(this.cents * factor, rounding), this.currency);
  }

  divide(divisor: number, rounding: RoundingMode = 'round'): Money {
    if (divisor === 0) throw new Error('Cannot divide money by zero');
    return new Money(this.applyRounding(this.cents / divisor, rounding), this.currency);
  }

  /** Allocate money across N parts, distributing remainder fairly. */
  allocate(ratios: number[]): Money[] {
    const total = ratios.reduce((a, b) => a + b, 0);
    if (total === 0) throw new Error('Ratios must sum to a positive number');

    const results: Money[] = [];
    let remainder = this.cents;

    for (const ratio of ratios) {
      const share = Math.floor((this.cents * ratio) / total);
      results.push(new Money(share, this.currency));
      remainder -= share;
    }

    // Distribute remainder one cent at a time
    for (let i = 0; remainder > 0; i++, remainder--) {
      results[i] = new Money(results[i].cents + 1, this.currency);
    }

    return results;
  }

  negate(): Money {
    return new Money(-this.cents, this.currency);
  }

  abs(): Money {
    return new Money(Math.abs(this.cents), this.currency);
  }

  // ── Comparison ──────────────────────────────────────────

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency.code === other.currency.code;
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents > other.cents;
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents < other.cents;
  }

  isZero(): boolean { return this.cents === 0; }
  isPositive(): boolean { return this.cents > 0; }
  isNegative(): boolean { return this.cents < 0; }

  // ── Formatting ──────────────────────────────────────────

  /** Returns the major-unit decimal value (e.g. 19.99). */
  toDecimal(): number {
    return this.cents / (10 ** this.currency.precision);
  }

  /** Format as a currency string (e.g. "$1,234.56"). */
  format(options?: { showSymbol?: boolean; showCode?: boolean }): string {
    const { showSymbol = true, showCode = false } = options ?? {};
    const def = this.currency.def;
    const isNeg = this.cents < 0;
    const absCents = Math.abs(this.cents);
    const factor = 10 ** def.precision;
    const major = Math.floor(absCents / factor);
    const minor = absCents % factor;

    // Format major part with thousands separator
    const majorStr = major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, def.thousandsSep);
    const minorStr = def.precision > 0
      ? def.decimalSep + minor.toString().padStart(def.precision, '0')
      : '';

    const number = `${isNeg ? '-' : ''}${majorStr}${minorStr}`;
    if (showCode) return `${number} ${def.code}`;
    if (showSymbol) return `${def.symbol}${number}`;
    return number;
  }

  toString(): string {
    return this.format();
  }

  toJSON(): { cents: number; currency: string } {
    return { cents: this.cents, currency: this.currency.code };
  }

  // ── Internals ───────────────────────────────────────────

  private assertSameCurrency(other: Money): void {
    if (this.currency.code !== other.currency.code) {
      throw new Error(
        `Cannot operate on different currencies: ${this.currency.code} vs ${other.currency.code}`,
      );
    }
  }

  private applyRounding(value: number, mode: RoundingMode): number {
    switch (mode) {
      case 'round': return Math.round(value);
      case 'ceil':  return Math.ceil(value);
      case 'floor': return Math.floor(value);
      case 'trunc': return Math.trunc(value);
    }
  }
}

// ── Number Formatting Utilities ───────────────────────────

/** Format a number with locale-aware separators. */
export function formatNumber(
  value: number,
  options?: {
    precision?: number;
    thousandsSep?: string;
    decimalSep?: string;
  },
): string {
  const { precision = 2, thousandsSep = ',', decimalSep = '.' } = options ?? {};
  const fixed = value.toFixed(precision);
  const [major, minor] = fixed.split('.');
  const majorFormatted = major.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
  return minor ? `${majorFormatted}${decimalSep}${minor}` : majorFormatted;
}

/** Parse a formatted number string back to a number. */
export function parseNumber(value: string): number {
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const result = Number.parseFloat(cleaned);
  if (!Number.isFinite(result)) throw new Error(`Cannot parse number: ${value}`);
  return result;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Round to N decimal places. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Calculate percentage: what percent is `part` of `total`? */
export function percentage(part: number, total: number, decimals = 2): number {
  if (total === 0) return 0;
  return roundTo((part / total) * 100, decimals);
}
