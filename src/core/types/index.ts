/**
 * @module @carpentry/core
 * @description Foundational types used across all framework contracts
 * @patterns None (pure type definitions)
 * @principles ISP — types split by concern; DIP — abstract tokens for DI
 */

// ============================================================
// IoC Token Types
// ============================================================

/** Abstract token for IoC container bindings — supports class, string, and symbol tokens */
export type Token<T = unknown> = AbstractClass<T> | string | symbol;

/** Any class constructor — used as a concrete binding target */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;

/** Abstract class reference — used as an interface token in TypeScript */
// biome-ignore lint/complexity/noBannedTypes: required for generic abstract class token support
export type AbstractClass<T = unknown> = Function & { prototype: T };

/** Factory function for IoC container */
export type Factory<T> = (container: IContainerResolver) => T;

// ============================================================
// Result Type (Rust-inspired error handling)
// ============================================================

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
  readonly err?: never;
}

export interface Err<E> {
  readonly ok: false;
  readonly value?: never;
  readonly err: E;
}

/** Discriminated union for explicit error handling — no raw throw in service/repo layer */
export type Result<T, E extends Error = Error> = Ok<T> | Err<E>;

/** Create a success result */
/**
 * @param {T} value
 * @returns {Ok<T>}
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Create an error result */
/**
 * @param {E} error
 * @returns {Err<E>}
 */
export function err<E extends Error>(error: E): Err<E> {
  return { ok: false, err: error };
}

// ============================================================
// Disposable Pattern
// ============================================================

/** Resources that need cleanup when scope is destroyed */
export interface IDisposable {
  dispose(): void | Promise<void>;
}

// ============================================================
// Minimal IContainerResolver (forward ref to avoid circular)
// ============================================================

export interface IContainerResolver {
  /**
   * @param {Token<T>} abstract
   * @returns {T}
   */
  make<T>(abstract: Token<T>): T;
  /**
   * @param {Token<T>} abstract
   * @param {Object} params
   * @returns {T}
   */
  makeWith<T>(abstract: Token<T>, params: Record<string, unknown>): T;
  /**
   * @param {Token} abstract
   * @returns {boolean}
   */
  bound(abstract: Token): boolean;
}

// ============================================================
// Utility Types
// ============================================================

/** Deep partial type for config overrides */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Make specific keys required */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Dictionary type */
export type Dictionary<T = unknown> = Record<string, T>;

/** Async or sync return */
export type MaybeAsync<T> = T | Promise<T>;

/** Unsubscribe function returned by event/subscription registrations */
export type Unsubscribe = () => void;
