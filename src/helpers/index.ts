/**
 * @module @carpentry/helpers
 * @description Str, Arr, and Collection utilities — the everyday helpers.
 *
 * Use this package to:
 * - Transform arrays with `Arr.*` and fluent `Collection` chains
 * - Convert casing and build slugs with `Str.*`
 * - Compose collection operations with `collect(items)`
 *
 * @example
 * ```ts
 * import { Arr, Str, collect } from './';
 *
 * const users = [{ id: 1 }, { id: 2 }];
 * const ids = Arr.pluck(users, 'id'); // [1, 2]
 *
 * Str.camel('hello_world'); // 'helloWorld'
 * collect([1,2,3]).filter((n) => n > 1).all(); // [2, 3]
 * ```
 * @patterns Fluent (Collection chaining)
 */

// ══════════════════════════════════════════════════════════
// Str — string utilities
// ══════════════════════════════════════════════════════════

export const Str = {
  /** "hello_world" → "helloWorld" */
  camel: (s: string): string =>
    s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase()),

  /** "helloWorld" → "hello_world" */
  snake: (s: string): string =>
    s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, ''),

  /** "helloWorld" → "hello-world" */
  kebab: (s: string): string =>
    Str.snake(s).replace(/_/g, '-'),

  /** "hello world" → "Hello World" */
  title: (s: string): string =>
    s.replace(/\b\w/g, (c) => c.toUpperCase()),

  /** "hello_world" → "HelloWorld" */
  pascal: (s: string): string => {
    const camel = Str.camel(s);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  },

  /** "User" → "users" */
  plural: (s: string): string => {
    if (s.endsWith('y') && !/[aeiou]y$/i.test(s)) return s.slice(0, -1) + 'ies';
    if (s.endsWith('s') || s.endsWith('x') || s.endsWith('ch') || s.endsWith('sh')) return s + 'es';
    return s + 's';
  },

  /** "users" → "user" (simple) */
  singular: (s: string): string => {
    if (s.endsWith('ies')) return s.slice(0, -3) + 'y';
    if (s.endsWith('ses') || s.endsWith('xes') || s.endsWith('ches') || s.endsWith('shes')) return s.slice(0, -2);
    if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
    return s;
  },

  /** "hello-world" → "Hello world" */
  headline: (s: string): string => {
    const words = s.replace(/[-_]/g, ' ').replace(/([A-Z])/g, ' $1').trim().split(/\s+/);
    return words.map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join(' ');
  },

  /** Generate a URL-safe slug */
  slug: (s: string, separator: string = '-'): string =>
    s.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, separator).replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), ''),

  /** Truncate with ellipsis */
  limit: (s: string, length: number, end: string = '...'): string =>
    s.length <= length ? s : s.slice(0, length - end.length) + end,

  /** "Hello :name, you have :count items" → "Hello Alice, you have 3 items" */
  replace: (s: string, replacements: Record<string, string | number>): string => {
    let result = s;
    for (const [key, val] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`:${key}`, 'g'), String(val));
    }
    return result;
  },

  /** Check if string contains substring (case-insensitive option) */
  contains: (haystack: string, needle: string, ignoreCase: boolean = false): boolean =>
    ignoreCase ? haystack.toLowerCase().includes(needle.toLowerCase()) : haystack.includes(needle),

  /** "hello" → true, "" → false, "  " → false */
  isFilled: (s: string | null | undefined): boolean =>
    s !== null && s !== undefined && s.trim().length > 0,

  /** Generate random string */
  random: (length: number = 16): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  },

  /** "Hello World" → "d10a516..." (simple hash, not cryptographic) */
  hash: (s: string): string => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  },

  /** "fooBarBaz" → ["foo", "Bar", "Baz"] */
  words: (s: string): string[] =>
    s.replace(/[-_]/g, ' ').split(/(?=[A-Z])|\s+/).filter(Boolean),

  /** Mask part of a string: "alice@example.com" → "ali***@example.com" */
  mask: (s: string, start: number, length: number, char: string = '*'): string =>
    s.slice(0, start) + char.repeat(Math.min(length, s.length - start)) + s.slice(start + length),

  /** Check if string matches a pattern with * wildcard */
  is: (pattern: string, value: string): boolean => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(value);
  },
};

// ══════════════════════════════════════════════════════════
// Arr — array utilities
// ══════════════════════════════════════════════════════════

export const Arr = {
  /** Get value by dot-notation key */
  get: <T = unknown>(obj: Record<string, unknown>, key: string, defaultValue?: T): T => {
    const parts = key.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return (defaultValue as T);
      current = (current as Record<string, unknown>)[part];
    }
    return (current as T) ?? (defaultValue as T);
  },

  /** Set value by dot-notation key */
  set: (obj: Record<string, unknown>, key: string, value: unknown): void => {
    const parts = key.split('.');
    if (parts.length === 0) return;
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part === undefined) continue;
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    if (leaf !== undefined) {
      current[leaf] = value;
    }
  },

  /** Pick specific keys from an object */
  only: <T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> => {
    const result: Partial<T> = {};
    for (const key of keys) {
      if (key in obj) (result as Record<string, unknown>)[key] = obj[key];
    }
    return result;
  },

  /** Omit specific keys from an object */
  except: <T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> => {
    const result = { ...obj };
    for (const key of keys) delete (result as Record<string, unknown>)[key];
    return result;
  },

  /** Flatten a nested array */
  flatten: <T>(arr: (T | T[])[]): T[] =>
    arr.reduce<T[]>((acc, item) => acc.concat(Array.isArray(item) ? Arr.flatten(item as (T | T[])[]) : [item]), []),

  /** Get unique values */
  unique: <T>(arr: T[]): T[] => [...new Set(arr)],

  /** Group by a key or function */
  groupBy: <T>(arr: T[], keyFn: ((item: T) => string) | string): Record<string, T[]> => {
    const result: Record<string, T[]> = {};
    for (const item of arr) {
      const key = typeof keyFn === 'function' ? keyFn(item) : String((item as Record<string, unknown>)[keyFn]);
      if (!result[key]) result[key] = [];
      result[key].push(item);
    }
    return result;
  },

  /** Key by a field */
  keyBy: <T>(arr: T[], key: string): Record<string, T> => {
    const result: Record<string, T> = {};
    for (const item of arr) result[String((item as Record<string, unknown>)[key])] = item;
    return result;
  },

  /** Chunk array into groups of n */
  chunk: <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  },

  /** Shuffle array (Fisher-Yates) */
  shuffle: <T>(arr: T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const left = result[i];
      const right = result[j];
      if (left !== undefined && right !== undefined) {
        result[i] = right;
        result[j] = left;
      }
    }
    return result;
  },

  /** Sum of numbers or by accessor */
  sum: <T>(arr: T[], fn?: (item: T) => number): number =>
    arr.reduce((acc, item) => acc + (fn ? fn(item) : Number(item)), 0),

  /** Sort by key (returns new array) */
  sortBy: <T>(arr: T[], key: string, dir: 'asc' | 'desc' = 'asc'): T[] =>
    [...arr].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key] as string | number, bv = (b as Record<string, unknown>)[key] as string | number;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    }),

  /** Pluck a single field from array of objects */
  pluck: <T, K extends string>(arr: T[], key: K): unknown[] =>
    arr.map((item) => (item as Record<string, unknown>)[key]),

  /** First item matching predicate, or first item */
  first: <T>(arr: T[], predicate?: (item: T) => boolean): T | undefined =>
    predicate ? arr.find(predicate) : arr[0],

  /** Last item */
  last: <T>(arr: T[]): T | undefined => arr[arr.length - 1],

  /** Partition into [matching, non-matching] */
  partition: <T>(arr: T[], predicate: (item: T) => boolean): [T[], T[]] => {
    const yes: T[] = [], no: T[] = [];
    for (const item of arr) (predicate(item) ? yes : no).push(item);
    return [yes, no];
  },

  /** Zip two arrays into pairs */
  zip: <A, B>(a: A[], b: B[]): [A, B][] =>
    a.flatMap((item, i) => (b[i] === undefined ? [] : [[item, b[i] as B]])),
};

// ══════════════════════════════════════════════════════════
// Collection — fluent chainable array wrapper
// ══════════════════════════════════════════════════════════

/**
 * Fluent wrapper around arrays (`map`, `filter`, `groupBy`, `pluck`, …) — use `Collection.of(items)`.
 *
 * @example
 * ```ts
 * import { Collection } from './';
 * Collection.of([{ id: 1 }, { id: 2 }]).pluck('id').toArray();
 * ```
 */
export class Collection<T> {
  constructor(private items: T[]) {}

  static of<T>(items: T[]): Collection<T> { return new Collection(items); }

  /**
   * @param {(item: T, index: number} fn
   * @returns {Collection<U>}
   */
  map<U>(fn: (item: T, index: number) => U): Collection<U> { return new Collection(this.items.map(fn)); }
  /**
   * @param {(item: T} fn
   * @returns {Collection<T>}
   */
  filter(fn: (item: T) => boolean): Collection<T> { return new Collection(this.items.filter(fn)); }
  /**
   * @param {(item: T} fn
   * @returns {Collection<T>}
   */
  reject(fn: (item: T) => boolean): Collection<T> { return this.filter((item) => !fn(item)); }
  /**
   * @param {(item: T} fn
   * @returns {Collection<U>}
   */
  flatMap<U>(fn: (item: T) => U[]): Collection<U> { return new Collection(this.items.flatMap(fn)); }
  /**
   * @param {string} key
   * @param {'asc' | 'desc'} [dir]
   * @returns {Collection<T>}
   */
  sortBy(key: string, dir: 'asc' | 'desc' = 'asc'): Collection<T> { return new Collection(Arr.sortBy(this.items, key, dir)); }
  /**
   * @param {string | ((item: T} key
   * @returns {Record<string, T[]>}
   */
  groupBy(key: string | ((item: T) => string)): Record<string, T[]> { return Arr.groupBy(this.items, key); }
  /**
   * @param {string} key
   * @returns {Record<string, T>}
   */
  keyBy(key: string): Record<string, T> { return Arr.keyBy(this.items, key); }
  /**
   * @param {string} key
   * @returns {Collection<unknown>}
   */
  pluck(key: string): Collection<unknown> { return new Collection(Arr.pluck(this.items, key)); }
  /**
   * @param {number} size
   * @returns {Collection<T[]>}
   */
  chunk(size: number): Collection<T[]> { return new Collection(Arr.chunk(this.items, size)); }
  unique(): Collection<T> { return new Collection(Arr.unique(this.items)); }
  flatten(): Collection<unknown> { return new Collection(Arr.flatten(this.items as unknown as (unknown | unknown[])[])); }
  /**
   * @param {(item: T} fn
   * @returns {[Collection<T>, Collection<T>]}
   */
  partition(fn: (item: T) => boolean): [Collection<T>, Collection<T>] {
    const [yes, no] = Arr.partition(this.items, fn);
    return [new Collection(yes), new Collection(no)];
  }

  /**
   * @param {(item: T} [predicate]
   * @returns {T | undefined}
   */
  first(predicate?: (item: T) => boolean): T | undefined { return Arr.first(this.items, predicate); }
  last(): T | undefined { return Arr.last(this.items); }
  count(): number { return this.items.length; }
  isEmpty(): boolean { return this.items.length === 0; }
  isNotEmpty(): boolean { return this.items.length > 0; }
  /**
   * @param {(item: T} [fn]
   * @returns {number}
   */
  sum(fn?: (item: T) => number): number { return Arr.sum(this.items, fn); }

  /**
   * @param {((item: T} predicate
   * @returns {boolean}
   */
  contains(predicate: ((item: T) => boolean) | T): boolean {
    return typeof predicate === 'function'
      ? this.items.some(predicate as (item: T) => boolean)
      : this.items.includes(predicate);
  }

  /**
   * @param {(item: T, index: number} fn
   * @returns {this}
   */
  each(fn: (item: T, index: number) => void): this { this.items.forEach(fn); return this; }
  /**
   * @param {(acc: U, item: T} fn
   * @returns {U}
   */
  reduce<U>(fn: (acc: U, item: T) => U, initial: U): U { return this.items.reduce(fn, initial); }
  /**
   * @param {number} n
   * @returns {Collection<T>}
   */
  take(n: number): Collection<T> { return new Collection(this.items.slice(0, n)); }
  /**
   * @param {number} n
   * @returns {Collection<T>}
   */
  skip(n: number): Collection<T> { return new Collection(this.items.slice(n)); }
  reverse(): Collection<T> { return new Collection([...this.items].reverse()); }

  toArray(): T[] { return [...this.items]; }
  toJSON(): T[] { return this.toArray(); }
}

/** Shorthand: collect([1,2,3]).filter(...).map(...).toArray() */
/**
 * @param {T[]} items
 * @returns {Collection<T>}
 */
export function collect<T>(items: T[]): Collection<T> {
  return Collection.of(items);
}
