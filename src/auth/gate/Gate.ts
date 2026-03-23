/**
 * @module @carpentry/auth
 * @description Gate — authorization with abilities, policies, before() hooks
 * @patterns Strategy (policy methods as strategies), Chain of Responsibility (before hook)
 * @principles OCP — new abilities/policies without modifying Gate; SRP — authorization only
 */

import type { GateCallback, IAuthenticatable, IGate } from "@carpentry/formworks/core/contracts";

/**
 * Authorization gate: define abilities and evaluate them for a user.
 *
 * The gate can also execute `before()` hooks and support policies for model instances.
 *
 * @example
 * ```ts
 * import { Gate } from '..';
 *
 * const gate = new Gate();
 *
 * // Ability callback receives (user, ...args)
 * gate.define('post.edit', (user, post) => user.id === post.authorId);
 *
 * const allowed = await gate.allows(user, 'post.edit', post);
 * if (!allowed) return;
 * ```
 *
 * @see {@link IGate} — Gate contract
 */
export class Gate implements IGate {
  private abilities = new Map<string, GateCallback>();
  // biome-ignore lint/complexity/noBannedTypes: Function types for policy map key/value
  private policies = new Map<Function, Function>();
  private beforeCallbacks: Array<
    (user: IAuthenticatable, ability: string) => boolean | null | Promise<boolean | null>
  > = [];

  /**
   * @param {string} ability
   * @param {GateCallback} callback
   */
  define(ability: string, callback: GateCallback): void {
    this.abilities.set(ability, callback);
  }

  /**
   * @param {Function} modelClass
   * @param {Function} policyClass
   */
  // biome-ignore lint/complexity/noBannedTypes: Function types for model/policy class references
  policy(modelClass: Function, policyClass: Function): void {
    this.policies.set(modelClass, policyClass);
  }

  /** Register a before hook — returning true bypasses all checks (super admin) */
  /**
   * @param {(user: IAuthenticatable, ability: string} callback
   */
  before(
    callback: (user: IAuthenticatable, ability: string) => boolean | null | Promise<boolean | null>,
  ): void {
    this.beforeCallbacks.push(callback);
  }

  /**
   * @param {IAuthenticatable} user
   * @param {string} ability
   * @param {unknown[]} ...args
   * @returns {Promise<boolean>}
   */
  async allows(user: IAuthenticatable, ability: string, ...args: unknown[]): Promise<boolean> {
    // Run before hooks — true grants, false denies, null continues
    for (const cb of this.beforeCallbacks) {
      const result = await cb(user, ability);
      if (result === true) return true;
      if (result === false) return false;
    }

    // Check ability definitions
    const callback = this.abilities.get(ability);
    if (callback) {
      return Boolean(await callback(user, ...args));
    }

    // Check policies — if args[0] is a model instance, look up its policy
    if (args.length > 0 && args[0] !== null && args[0] !== undefined) {
      const model = args[0];
      const modelConstructor = (model as object).constructor;
      const PolicyClass = this.policies.get(modelConstructor);

      if (PolicyClass) {
        // biome-ignore lint/complexity/noBannedTypes: Function type for policy class lookup
        const policy = new (PolicyClass as new () => Record<string, Function>)();
        const method = policy[ability];
        if (typeof method === "function") {
          return Boolean(await method.call(policy, user, model));
        }
      }
    }

    return false;
  }

  /**
   * @param {IAuthenticatable} user
   * @param {string} ability
   * @param {unknown[]} ...args
   * @returns {Promise<boolean>}
   */
  async denies(user: IAuthenticatable, ability: string, ...args: unknown[]): Promise<boolean> {
    return !(await this.allows(user, ability, ...args));
  }

  /** Check if an ability is defined */
  /**
   * @param {string} ability
   * @returns {boolean}
   */
  has(ability: string): boolean {
    return this.abilities.has(ability);
  }
}
