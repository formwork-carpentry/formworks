/**
 * @module @formwork/orm
 * @description Model type definitions
 */



export type ModelEvent =
  | 'creating' | 'created'
  | 'updating' | 'updated'
  | 'saving' | 'saved'
  | 'deleting' | 'deleted'
  | 'restoring' | 'restored';

export type ModelEventHandler<T = unknown> = (model: T) => void | Promise<void> | false;

/** Available cast types for model attributes */
export type CastType = 'string' | 'number' | 'boolean' | 'date' | 'json';
