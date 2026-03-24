/**
 * @module @carpentry/formworks
 * @description Carpenter Framework core primitives.
 * Prefer subpath imports for tree-shaking:
 *   import { BaseModel } from '@carpentry/formworks/orm'
 */
export * from './core';
export * from './contracts';
export * from './adapters';
export * from './tooling';
export * from './http';
export * from './foundation';
export * from './auth';
export * from './orm';
export * from './db';
export * from './validation';
export * from './events';
export * from './session';
export * from './log';
export * from './cache';
export * from './queue';
export * from './mail';
export * from './storage';
export * from './bridge';
export * from './resilience';
export * from './scheduler';
export * from './flags';
export * from './notifications';
export * from './tenancy';
export * from './i18n';
export * from './ui';
export * from './helpers';
export * from './http-client';
export * from './media';
export * from './encrypt';
export * from './crypto';
export * from './number';
export * from './pipeline';
// testing and faker excluded — dev-only, use subpath imports
