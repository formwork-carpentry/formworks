/**
 * @module @carpentry/graphql
 * @description Code-first GraphQL decorators — define schema from TypeScript classes
 * @patterns Decorator (metadata annotation), Registry (type/resolver collection), Builder (schema assembly)
 * @principles OCP (add types without modifying schema builder), DIP (resolvers decoupled from transport)
 */

import "reflect-metadata";

// ── Metadata Storage ──────────────────────────────────────

// biome-ignore lint/complexity/noBannedTypes: decorator registry requires Function as class constructor key
const TYPE_REGISTRY = new Map<Function, ObjectTypeMetadata>();
// biome-ignore lint/complexity/noBannedTypes: decorator registry requires Function as class constructor key
const RESOLVER_REGISTRY = new Map<Function, ResolverMetadata>();

interface FieldMetadata {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  deprecation?: string;
}

interface ObjectTypeMetadata {
  name: string;
  description?: string;
  fields: Map<string, FieldMetadata>;
}

interface ResolverMethodMetadata {
  name: string;
  methodName: string;
  type: "query" | "mutation" | "subscription";
  returnType?: string;
  description?: string;
  args: Map<string, ArgMetadata>;
}

interface ResolverMetadata {
  forType?: string;
  methods: Map<string, ResolverMethodMetadata>;
}

interface ArgMetadata {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  index: number;
}

// ── @ObjectType ───────────────────────────────────────────

/**
 * Marks a class as a GraphQL Object Type.
 *
 * @example
 * ```ts
 * @ObjectType({ description: 'A blog post' })
 * class Post {
 *   @Field('ID') id!: string;
 *   @Field('String') title!: string;
 *   @Field('String', { nullable: true }) body?: string;
 *   @Field('Int') viewCount!: number;
 * }
 * ```
 */
export function ObjectType(options: { name?: string; description?: string } = {}): ClassDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript ClassDecorator type
  return (target: Function) => {
    const existing = TYPE_REGISTRY.get(target) ?? {
      name: options.name ?? target.name,
      description: options.description,
      fields: new Map(),
    };
    existing.name = options.name ?? existing.name;
    existing.description = options.description ?? existing.description;
    TYPE_REGISTRY.set(target, existing);
  };
}

// ── @Field ────────────────────────────────────────────────

/**
 * Marks a property as a GraphQL field on an ObjectType.
 *
 * @param type - GraphQL type string: 'String', 'Int', 'Float', 'Boolean', 'ID', '[String]', etc.
 * @param options - nullable, description, deprecation
 */
export function Field(
  type: string,
  options: { nullable?: boolean; description?: string; deprecation?: string } = {},
): PropertyDecorator {
  /**
   * @param {Object} target
   * @param {string | symbol} propertyKey
   */
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript PropertyDecorator type
  return (target: Object, propertyKey: string | symbol) => {
    const ctor = target.constructor;
    const existing = TYPE_REGISTRY.get(ctor) ?? { name: ctor.name, fields: new Map() };

    existing.fields.set(String(propertyKey), {
      name: String(propertyKey),
      type,
      nullable: options.nullable ?? false,
      description: options.description,
      deprecation: options.deprecation,
    });

    TYPE_REGISTRY.set(ctor, existing);
  };
}

// ── @Resolver ─────────────────────────────────────────────

/**
 * Marks a class as a GraphQL Resolver.
 *
 * @example
 * ```ts
 * @Resolver('Post')
 * class PostResolver {
 *   @Query('Post', { name: 'post' })
 *   async getPost(@Arg('id', 'ID') id: string) { ... }
 *
 *   @Mutation('Post')
 *   async createPost(@Arg('title', 'String') title: string) { ... }
 * }
 * ```
 */
export function Resolver(forType?: string): ClassDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript ClassDecorator type
  return (target: Function) => {
    const existing: ResolverMetadata = RESOLVER_REGISTRY.get(target) ?? {
      forType,
      methods: new Map(),
    };
    existing.forType = forType;
    RESOLVER_REGISTRY.set(target, existing);
  };
}

// ── @Query / @Mutation / @Subscription ────────────────────

function createMethodDecorator(operationType: "query" | "mutation" | "subscription") {
  return (
    returnType: string,
    options: { name?: string; description?: string } = {},
  ): MethodDecorator =>
    // biome-ignore lint/complexity/noBannedTypes: required by TypeScript MethodDecorator type
    (target: Object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
      const ctor = target.constructor;
      const existing = RESOLVER_REGISTRY.get(ctor) ?? { methods: new Map() };

      const methodName = String(propertyKey);
      const existingMethod = existing.methods.get(methodName);

      existing.methods.set(methodName, {
        name: options.name ?? methodName,
        methodName,
        type: operationType,
        returnType,
        description: options.description,
        args: existingMethod?.args ?? new Map(),
      });

      RESOLVER_REGISTRY.set(ctor, existing);
    };
}

/** Mark a method as a GraphQL Query resolver */
export const Query = createMethodDecorator("query");

/** Mark a method as a GraphQL Mutation resolver */
export const Mutation = createMethodDecorator("mutation");

/** Mark a method as a GraphQL Subscription resolver */
export const Subscription = createMethodDecorator("subscription");

// ── @Arg ──────────────────────────────────────────────────

/**
 * Mark a method parameter as a GraphQL argument.
 */
export function Arg(
  name: string,
  type: string,
  options: { nullable?: boolean; defaultValue?: unknown } = {},
): ParameterDecorator {
  /**
   * @param {Object} target
   * @param {string | symbol | undefined} propertyKey
   * @param {number} parameterIndex
   */
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript ParameterDecorator type
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;
    const ctor = target.constructor;
    const existing = RESOLVER_REGISTRY.get(ctor) ?? { methods: new Map() };

    const methodName = String(propertyKey);
    const method = existing.methods.get(methodName) ?? {
      name: methodName,
      methodName,
      type: "query" as const,
      args: new Map(),
    };

    method.args.set(name, {
      name,
      type,
      nullable: options.nullable ?? false,
      defaultValue: options.defaultValue,
      index: parameterIndex,
    });

    existing.methods.set(methodName, method);
    RESOLVER_REGISTRY.set(ctor, existing);
  };
}

// ── Registry Access ───────────────────────────────────────

/** Get the metadata for a registered ObjectType */
/**
 * @param {Function} target
 * @returns {ObjectTypeMetadata | undefined}
 */
// biome-ignore lint/complexity/noBannedTypes: decorator registry uses Function as class constructor key
export function getTypeMetadata(target: Function): ObjectTypeMetadata | undefined {
  return TYPE_REGISTRY.get(target);
}

/** Get the metadata for a registered Resolver */
/**
 * @param {Function} target
 * @returns {ResolverMetadata | undefined}
 */
// biome-ignore lint/complexity/noBannedTypes: decorator registry uses Function as class constructor key
export function getResolverMetadata(target: Function): ResolverMetadata | undefined {
  return RESOLVER_REGISTRY.get(target);
}

/** Get all registered ObjectTypes */
// biome-ignore lint/complexity/noBannedTypes: decorator registry uses Function as class constructor key
export function getAllTypes(): Map<Function, ObjectTypeMetadata> {
  return new Map(TYPE_REGISTRY);
}

/** Get all registered Resolvers */
// biome-ignore lint/complexity/noBannedTypes: decorator registry uses Function as class constructor key
export function getAllResolvers(): Map<Function, ResolverMetadata> {
  return new Map(RESOLVER_REGISTRY);
}

/** Clear registries (for testing) */
export function clearRegistries(): void {
  TYPE_REGISTRY.clear();
  RESOLVER_REGISTRY.clear();
}

// ── Schema Generation from Decorators ─────────────────────

/**
 * Build a GraphQL SDL string from decorated classes.
 *
 * @example
 * ```ts
 * const sdl = buildSchemaFromDecorators([Post, User], [PostResolver, UserResolver]);
 * console.log(sdl);
 * // type Post { id: ID!, title: String!, ... }
 * // type Query { post(id: ID!): Post, posts: [Post] }
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: schema builder iterates multiple registry collections by design
// biome-ignore lint/complexity/noBannedTypes: decorator registry uses Function as class constructor key
export function buildSchemaFromDecorators(types: Function[], resolvers: Function[]): string {
  const lines: string[] = [];

  // Object types
  /**
   * @param {unknown} const type of types
   */
  for (const type of types) {
    const meta = TYPE_REGISTRY.get(type);
    if (!meta) continue;
    lines.push(buildTypeSDL(meta));
  }

  // Query/Mutation/Subscription types from resolvers
  const queries: string[] = [];
  const mutations: string[] = [];
  const subscriptions: string[] = [];

  /**
   * @param {unknown} const resolver of resolvers
   */
  for (const resolver of resolvers) {
    const meta = RESOLVER_REGISTRY.get(resolver);
    if (!meta) continue;

    for (const method of meta.methods.values()) {
      const argStr = buildArgSDL(method.args);
      const fieldDef = `  ${method.name}${argStr}: ${method.returnType ?? "String"}`;

      if (method.type === "query") queries.push(fieldDef);
      else if (method.type === "mutation") mutations.push(fieldDef);
      else if (method.type === "subscription") subscriptions.push(fieldDef);
    }
  }

  /**
   * @param {unknown} queries.length > 0
   */
  if (queries.length > 0) lines.push(`type Query {\n${queries.join("\n")}\n}`);
  /**
   * @param {unknown} mutations.length > 0
   */
  if (mutations.length > 0) lines.push(`type Mutation {\n${mutations.join("\n")}\n}`);
  /**
   * @param {unknown} subscriptions.length > 0
   */
  if (subscriptions.length > 0) lines.push(`type Subscription {\n${subscriptions.join("\n")}\n}`);

  return `${lines.join("\n\n")}\n`;
}

function buildTypeSDL(meta: ObjectTypeMetadata): string {
  const desc = meta.description ? `"""${meta.description}"""\n` : "";
  const fields = [...meta.fields.values()]
    .map((f) => {
      const nullable = f.nullable ? "" : "!";
      const deprecation = f.deprecation ? ` @deprecated(reason: "${f.deprecation}")` : "";
      return `  ${f.name}: ${f.type}${nullable}${deprecation}`;
    })
    .join("\n");
  return `${desc}type ${meta.name} {\n${fields}\n}`;
}

function buildArgSDL(args: Map<string, ArgMetadata>): string {
  /**
   * @param {unknown} [args.size === 0]
   */
  if (args.size === 0) return "";
  const argStrs = [...args.values()]
    .sort((a, b) => a.index - b.index)
    .map((a) => {
      const nullable = a.nullable ? "" : "!";
      const def = a.defaultValue !== undefined ? ` = ${JSON.stringify(a.defaultValue)}` : "";
      return `${a.name}: ${a.type}${nullable}${def}`;
    });
  return `(${argStrs.join(", ")})`;
}
