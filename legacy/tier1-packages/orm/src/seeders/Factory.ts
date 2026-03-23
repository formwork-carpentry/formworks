/**
 * @module @carpentry/orm
 * @description Model factory and seeders for test data generation
 * @patterns Factory Method (factory.definition), Template Method (BaseSeeder.run)
 * @principles SRP — factory builds models, seeder orchestrates; OCP — states extend without modifying
 */

import { BaseModel } from '../model/BaseModel.js';
import type { Dictionary } from '@carpentry/core/types';
import { createFaker, type FakerManager, type FakerSeed } from '@carpentry/faker';

type FactoryDefinition = (faker?: FakerManager) => Dictionary;

// ── Model Factory ─────────────────────────────────────────

/**
 * ModelFactory — builds test model instances with optional named states and `count()`.
 *
 * `make()` returns unsaved models; `create()` persists via the model (when implemented).
 *
 * @example
 * ```ts
 * const factory = new ModelFactory(User, () => ({ name: 'User', email: 'u@test.com' }))
 *   .state('admin', () => ({ role: 'admin' }));
 * const u = factory.withState('admin').make() as User;
 * ```
 */
export class ModelFactory<T extends BaseModel> {
  private modelClass: (new (attrs?: Dictionary) => T) & typeof BaseModel;
  private stateOverrides: Dictionary = {};
  private countN: number = 1;
  private definitionFn: FactoryDefinition;
  private states = new Map<string, () => Dictionary>();
  private faker: FakerManager = createFaker();

  constructor(
    modelClass: (new (attrs?: Dictionary) => T) & typeof BaseModel,
    definition: FactoryDefinition,
  ) {
    this.modelClass = modelClass;
    this.definitionFn = definition;
  }

  /** Define a named state that overrides specific attributes */
  /**
   * @param {string} name
   * @param {(} overrides
   * @returns {this}
   */
  state(name: string, overrides: () => Dictionary): this {
    this.states.set(name, overrides);
    return this;
  }

  /** Apply a named state for the next make/create call */
  /**
   * @param {string} name
   * @returns {this}
   */
  withState(name: string): this {
    const stateFn = this.states.get(name);
    if (!stateFn) throw new Error(`Factory state "${name}" is not defined.`);
    this.stateOverrides = { ...this.stateOverrides, ...stateFn() };
    return this;
  }

  /** Set the number of models to create */
  /**
   * @param {number} n
   * @returns {this}
   */
  count(n: number): this {
    this.countN = n;
    return this;
  }

  /** Seed the per-factory faker instance for deterministic output */
  /**
   * @param {FakerSeed} value
   * @returns {this}
   */
  seed(value: FakerSeed): this {
    this.faker.seed(value);
    return this;
  }

  /** Build model instances WITHOUT saving to database */
  /**
   * @param {Dictionary} [overrides]
   * @returns {T | T[]}
   */
  make(overrides: Dictionary = {}): T | T[] {
    const count = this.countN;
    const models: T[] = [];
    for (let i = 0; i < count; i++) {
      const attrs = { ...this.definitionFn(this.faker), ...this.stateOverrides, ...overrides };
      const model = new this.modelClass(attrs);
      models.push(model);
    }
    this.resetChain();
    return count === 1 ? models[0] : models;
  }

  /** Build and persist model instances to the database */
  /**
   * @param {Dictionary} [overrides]
   * @returns {Promise<T | T[]>}
   */
  async create(overrides: Dictionary = {}): Promise<T | T[]> {
    const count = this.countN;
    const models: T[] = [];
    for (let i = 0; i < count; i++) {
      const attrs = { ...this.definitionFn(this.faker), ...this.stateOverrides, ...overrides };
      const model = new this.modelClass(attrs);
      await model.save();
      models.push(model);
    }
    this.resetChain();
    return count === 1 ? models[0] : models;
  }

  private resetChain(): void {
    this.countN = 1;
    this.stateOverrides = {};
  }
}

// ── Define Factory Helper ─────────────────────────────────

/**
 * @param {(new (attrs?: Dictionary} [modelClass]
 * @returns {ModelFactory<T>}
 */
export function defineFactory<T extends BaseModel>(
  modelClass: (new (attrs?: Dictionary) => T) & typeof BaseModel,
  definition: FactoryDefinition,
): ModelFactory<T> {
  return new ModelFactory<T>(modelClass, definition);
}

// ── Base Seeder (Template Method) ─────────────────────────

export abstract class BaseSeeder {
  /** Override this method to seed your data */
  abstract run(): Promise<void>;

  /** Call another seeder */
  protected async call(seeder: BaseSeeder): Promise<void> {
    await seeder.run();
  }
}
