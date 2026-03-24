/**
 * @module @carpentry/i18n
 * @description Pluralizer — selects correct plural form from pipe-separated translation strings
 * @patterns Strategy (per-locale plural rules)
 * @principles SRP — pluralization logic only; OCP — add new locale rules without modifying core
 */

import type { IPluralizer } from '@carpentry/formworks/contracts';

/**
 * Pluralizer — picks the right segment from pipe-separated translation strings.
 *
 * Used by {@link Translator.choice} for keys like `{0} None|{1} One|[2,*] Many`.
 *
 * @example
 * ```ts
 * const p = new Pluralizer();
 * p.choose('{0} no items|{1} one item|[2,*] many items', 0, 'en'); // "no items"
 * p.choose('{0} no items|{1} one item|[2,*] many items', 5, 'en'); // "many items"
 * ```
 */
export class Pluralizer implements IPluralizer {
  /**
   * Choose the correct plural form from a pipe-separated string.
   *
   * Formats supported:
   *   "item|items"                              — simple 2-form
   *   "{0} None|{1} One|[2,*] Many"             — range-based
   *   "{0} No items|{1} :count item|[2,*] :count items" — with count replacement
   *   "one|few|many|other"                      — multi-form (Slavic etc.)
   */
  choose(line: string, count: number, locale: string): string {
    const segments = line.split('|');

    // 1. Try explicit match: {n} prefix
    for (const segment of segments) {
      const exactMatch = segment.match(/^\{(\d+)\}\s*(.*)/);
      if (exactMatch && Number(exactMatch[1]) === count) {
        return exactMatch[2].trim();
      }
    }

    // 2. Try range match: [min,max] prefix
    for (const segment of segments) {
      const rangeMatch = segment.match(/^\[(\d+),(\d+|\*)]\s*(.*)/);
      if (rangeMatch) {
        const min = Number(rangeMatch[1]);
        const max = rangeMatch[2] === '*' ? Infinity : Number(rangeMatch[2]);
        if (count >= min && count <= max) {
          return rangeMatch[3].trim();
        }
      }
    }

    // 3. Simple plural index (no explicit markers)
    // Strip any {n} or [n,m] prefixes that didn't match
    const cleanSegments = segments.map((s) =>
      s.replace(/^\{\d+\}\s*/, '').replace(/^\[\d+,\d+\*?\]\s*/, '').trim()
    );

    const index = this.getPluralIndex(count, locale);
    if (index < cleanSegments.length) {
      return cleanSegments[index];
    }

    // Fallback to last segment
    return cleanSegments[cleanSegments.length - 1];
  }

  /**
   * Get the plural form index for a given count and locale.
   * Implements CLDR plural rules for common locales.
   */
  private getPluralIndex(count: number, locale: string): number {
    const lang = locale.split('-')[0].split('_')[0].toLowerCase();
    const rule = PLURAL_RULES[lang] ?? PLURAL_RULES['_default'];
    return rule(count);
  }
}

// ── CLDR Plural Rule Functions ────────────────────────────

type PluralRule = (n: number) => number;

const twoForm: PluralRule = (n) => n === 1 ? 0 : 1;
const frenchForm: PluralRule = (n) => n <= 1 ? 0 : 1;
const noPlural: PluralRule = () => 0;

const slavicEast: PluralRule = (n) => {
  if (n % 10 === 1 && n % 100 !== 11) return 0;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 1;
  return 2;
};

const polish: PluralRule = (n) => {
  if (n === 1) return 0;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 1;
  return 2;
};

const czechSlovak: PluralRule = (n) => {
  if (n === 1) return 0;
  if (n >= 2 && n <= 4) return 1;
  return 2;
};

const arabic: PluralRule = (n) => {
  if (n === 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n % 100 >= 3 && n % 100 <= 10) return 3;
  if (n % 100 >= 11 && n % 100 <= 99) return 4;
  return 5;
};

const PLURAL_RULES: Record<string, PluralRule> = Object.fromEntries([
  ...['en','de','nl','sv','da','no','nb','nn','fi','es','pt','it','el','bg','hu','tr','ka',
      'he','hi','bn','ta','te','mr','sw','yo','ig','ha','zu','xh','am','ee','tw'].map(l => [l, twoForm]),
  ...['fr','ff'].map(l => [l, frenchForm]),
  ...['ru','uk','sr','hr','bs'].map(l => [l, slavicEast]),
  ['pl', polish], ['cs', czechSlovak], ['sk', czechSlovak], ['ar', arabic],
  ...['ja','zh','ko','vi','th','lo','my','km'].map(l => [l, noPlural]),
  ['_default', twoForm],
]);
