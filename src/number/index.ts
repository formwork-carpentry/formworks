/**
 * @module @carpentry/number
 * @description Number and money utilities with immutable bigint minor-unit money values.
 */

export type RoundStrategy = "round" | "ceil" | "floor" | "trunc";

export class NumberManager {
  format(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(locale, options).format(value);
  }

  parse(value: string, _locale = "en-US"): number {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Unable to parse numeric value: ${value}`);
    }
    return parsed;
  }

  clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  round(value: number, precision: number, strategy: RoundStrategy = "round"): number {
    const factor = 10 ** precision;
    const scaled = value * factor;

    switch (strategy) {
      case "ceil":
        return Math.ceil(scaled) / factor;
      case "floor":
        return Math.floor(scaled) / factor;
      case "trunc":
        return Math.trunc(scaled) / factor;
      default:
        return Math.round(scaled) / factor;
    }
  }

  percentage(value: number, total: number): number {
    if (total === 0) {
      return 0;
    }
    return (value / total) * 100;
  }

  ordinal(n: number): string {
    const abs = Math.abs(Math.trunc(n));
    const mod100 = abs % 100;
    if (mod100 >= 11 && mod100 <= 13) {
      return `${n}th`;
    }

    switch (abs % 10) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  }
}

/**
 * Immutable money value object storing minor units in bigint.
 */
export class Money {
  readonly amount: bigint;
  readonly currency: string;

  constructor(amount: bigint | string, currency: string) {
    this.amount = typeof amount === "string" ? BigInt(amount) : amount;
    this.currency = currency.toUpperCase();
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    const next = BigInt(Math.round(Number(this.amount) * factor));
    return new Money(next, this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  format(locale = "en-US"): string {
    const major = Number(this.amount) / 100;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: this.currency,
    }).format(major);
  }

  toObject(): { amount: string; currency: string } {
    return {
      amount: this.amount.toString(),
      currency: this.currency,
    };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
