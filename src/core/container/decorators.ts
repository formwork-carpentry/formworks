/**
 * @module @carpentry/core
 * @description TypeScript decorators for IoC container integration
 * @patterns Decorator (structural GoF — adds metadata without modifying class)
 * @principles OCP — classes declare injectability without touching container code
 *             DIP — @Inject overrides auto-wired tokens with abstract interface tokens
 */

import "reflect-metadata";
import { METADATA_KEYS } from "../../contracts/container/index.js";
import type { Token } from "../types/index.js";

/**
 * Marks a class as resolvable by the IoC container via auto-wiring.
 * Constructor parameter types are read from reflect-metadata.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class UserService {
 *   constructor(private readonly repo: IUserRepository) {}
 * }
 * ```
 */
export function Injectable(): ClassDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript ClassDecorator signature
  return (target: Function) => {
    Reflect.defineMetadata(METADATA_KEYS.INJECTABLE, true, target);
  };
}

/**
 * Marks a class as a singleton — only one instance created per container.
 * Implies @Injectable().
 *
 * @example
 * ```typescript
 * @Singleton()
 * class ConfigManager {
 *   // Only one instance will ever exist per container
 * }
 * ```
 */
export function Singleton(): ClassDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript ClassDecorator signature
  return (target: Function) => {
    Reflect.defineMetadata(METADATA_KEYS.INJECTABLE, true, target);
    Reflect.defineMetadata(METADATA_KEYS.SINGLETON, true, target);
  };
}

/**
 * Overrides the auto-wired token for a specific constructor parameter.
 * Use when the parameter type is an interface (which has no runtime representation)
 * or when you want to bind to a named/symbol token.
 *
 * @param token - The IoC token to resolve for this parameter
 *
 * @example
 * ```typescript
 * @Injectable()
 * class UserService {
 *   constructor(
 *     @Inject('IUserRepository') private readonly users: IUserRepository,
 *     @Inject('IHashManager') private readonly hash: IHashManager,
 *   ) {}
 * }
 * ```
 */
export function Inject(token: Token): ParameterDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript ParameterDecorator signature
  return (target: Object, _propertyKey: string | symbol | undefined, parameterIndex: number) => {
    Reflect.defineMetadata(`${METADATA_KEYS.INJECT}:${parameterIndex}`, token, target);
  };
}

/**
 * Named binding support — shorthand for @Inject with a string token.
 *
 * @param name - The named binding to resolve
 *
 * @example
 * ```typescript
 * @Injectable()
 * class NotificationService {
 *   constructor(@Named('smsProvider') private readonly sms: ISmsProvider) {}
 * }
 * ```
 */
export function Named(name: string): ParameterDecorator {
  return Inject(name);
}

/**
 * Marks a parameter as optional — container returns undefined instead of throwing
 * if no binding is found.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class ReportService {
 *   constructor(@Optional() private readonly cache?: ICacheStore) {}
 * }
 * ```
 */
export function Optional(): ParameterDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript ParameterDecorator signature
  return (target: Object, _propertyKey: string | symbol | undefined, parameterIndex: number) => {
    Reflect.defineMetadata(`${METADATA_KEYS.OPTIONAL}:${parameterIndex}`, true, target);
  };
}
