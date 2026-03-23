/**
 * @module @carpentry/graphql
 * @description GraphQL Federation v2 support — decorators and schema extensions for
 * building federated subgraph services that compose into a single supergraph.
 *
 * WHY: Large apps split their GraphQL schema into independently deployable subgraphs.
 * Federation v2 (Apollo standard) allows each service to own its portion of the schema
 * while cross-referencing entities across service boundaries.
 *
 * HOW: Decorate entity types with @FederationKey to define lookup keys. Use @External
 * and @Provides to declare fields resolved by other subgraphs. Then call
 * buildFederatedSchema() to generate SDL with federation directives.
 *
 * @patterns Decorator (metadata annotation), Builder (federated SDL generation)
 * @principles OCP (add subgraphs without modifying supergraph), SRP (federation metadata only)
 *
 * @example
 * ```ts
 * // In the "users" subgraph:
 * class User {
 *   id!: string;
 *   name!: string;
 *   email!: string;
 * }
 * ObjectType()(User);
 * Field('ID')(User.prototype, 'id');
 * Field('String')(User.prototype, 'name');
 * Field('String')(User.prototype, 'email');
 * FederationKey('id')(User);
 *
 * // In the "reviews" subgraph:
 * class Review {
 *   id!: string;
 *   body!: string;
 *   author!: unknown; // resolved by users subgraph
 * }
 * ObjectType()(Review);
 * FederationKey('id')(Review);
 * External()(Review.prototype, 'author');
 *
 * const sdl = buildFederatedSchema([User], []);
 * // type User @key(fields: "id") { id: ID!, name: String!, email: String! }
 * ```
 */

// ── Federation Metadata Storage ───────────────────────────

// biome-ignore lint/complexity/noBannedTypes: federation registry requires Function as class constructor key
const FEDERATION_KEYS = new Map<Function, string[]>();
// biome-ignore lint/complexity/noBannedTypes: federation registry requires Function as class constructor key
const EXTERNAL_FIELDS = new Map<Function, Set<string>>();
// biome-ignore lint/complexity/noBannedTypes: federation registry requires Function as class constructor key
const PROVIDES_FIELDS = new Map<Function, Map<string, string>>();
// biome-ignore lint/complexity/noBannedTypes: federation registry requires Function as class constructor key
const REQUIRES_FIELDS = new Map<Function, Map<string, string>>();

/**
 * Mark a type as a Federation entity with a key field(s).
 * The key field is used by the gateway to look up this entity across subgraphs.
 *
 * @param fields - Space-separated key field names (e.g., 'id' or 'id sku')
 *
 * @example
 * ```ts
 * FederationKey('id')(User);           // single key
 * FederationKey('id sku')(Product);    // composite key
 * ```
 */
export function FederationKey(fields: string): ClassDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript ClassDecorator type
  return (target: Function) => {
    const existing = FEDERATION_KEYS.get(target) ?? [];
    existing.push(fields);
    FEDERATION_KEYS.set(target, existing);
  };
}

/**
 * Mark a field as externally resolved (owned by another subgraph).
 * This field's data comes from the subgraph that owns its parent type.
 */
export function External(): PropertyDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript PropertyDecorator type
  return (target: Object, propertyKey: string | symbol) => {
    const ctor = target.constructor;
    const fields = EXTERNAL_FIELDS.get(ctor) ?? new Set();
    fields.add(String(propertyKey));
    EXTERNAL_FIELDS.set(ctor, fields);
  };
}

/**
 * Declare that this subgraph can provide a field from an entity it extends.
 *
 * @param fields - The field(s) this subgraph provides (e.g., 'name email')
 */
export function Provides(fields: string): PropertyDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript PropertyDecorator type
  return (target: Object, propertyKey: string | symbol) => {
    const ctor = target.constructor;
    const map = PROVIDES_FIELDS.get(ctor) ?? new Map();
    map.set(String(propertyKey), fields);
    PROVIDES_FIELDS.set(ctor, map);
  };
}

/**
 * Declare that a field requires additional fields from the parent entity.
 *
 * @param fields - The field(s) required (e.g., 'price weight')
 */
export function Requires(fields: string): PropertyDecorator {
  // biome-ignore lint/complexity/noBannedTypes: required by TypeScript PropertyDecorator type
  return (target: Object, propertyKey: string | symbol) => {
    const ctor = target.constructor;
    const map = REQUIRES_FIELDS.get(ctor) ?? new Map();
    map.set(String(propertyKey), fields);
    REQUIRES_FIELDS.set(ctor, map);
  };
}

// ── Metadata Accessors ────────────────────────────────────

/** Get federation keys for a type */
/**
 * @param {Function} target
 * @returns {string[]}
 */
// biome-ignore lint/complexity/noBannedTypes: federation registry uses Function as class constructor key
export function getFederationKeys(target: Function): string[] {
  return FEDERATION_KEYS.get(target) ?? [];
}

/** Check if a field is marked as external */
/**
 * @param {Function} target
 * @param {string} fieldName
 * @returns {boolean}
 */
// biome-ignore lint/complexity/noBannedTypes: federation registry uses Function as class constructor key
export function isExternalField(target: Function, fieldName: string): boolean {
  return EXTERNAL_FIELDS.get(target)?.has(fieldName) ?? false;
}

/** Get provides metadata for a field */
/**
 * @param {Function} target
 * @param {string} fieldName
 * @returns {string | undefined}
 */
// biome-ignore lint/complexity/noBannedTypes: federation registry uses Function as class constructor key
export function getProvides(target: Function, fieldName: string): string | undefined {
  return PROVIDES_FIELDS.get(target)?.get(fieldName);
}

/** Get requires metadata for a field */
/**
 * @param {Function} target
 * @param {string} fieldName
 * @returns {string | undefined}
 */
// biome-ignore lint/complexity/noBannedTypes: federation registry uses Function as class constructor key
export function getRequires(target: Function, fieldName: string): string | undefined {
  return REQUIRES_FIELDS.get(target)?.get(fieldName);
}

/** Clear all federation registries (for testing) */
export function clearFederationRegistries(): void {
  FEDERATION_KEYS.clear();
  EXTERNAL_FIELDS.clear();
  PROVIDES_FIELDS.clear();
  REQUIRES_FIELDS.clear();
}

// ── Federated Schema Generation ───────────────────────────

import { buildSchemaFromDecorators, getTypeMetadata } from "./decorators.js";

/**
 * Build a federated SDL string from decorated types.
 * Adds Federation v2 directives (@key, @external, @provides, @requires)
 * and the required `extend schema @link(...)` header.
 */
// biome-ignore lint/complexity/noBannedTypes: decorator registry uses Function as class constructor key
export function buildFederatedSchema(types: Function[], resolvers: Function[]): string {
  const lines: string[] = [];

  // Federation v2 schema extension header
  lines.push(
    'extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@external", "@provides", "@requires"])',
  );

  // Build each type with federation directives
  /**
   * @param {unknown} const type of types
   */
  for (const type of types) {
    const meta = getTypeMetadata(type);
    if (!meta) continue;

    const keys = FEDERATION_KEYS.get(type) ?? [];
    const keyDirectives = keys.map((k) => `@key(fields: "${k}")`).join(" ");
    const typeLine = keyDirectives ? `type ${meta.name} ${keyDirectives}` : `type ${meta.name}`;

    const fieldLines = [...meta.fields.values()].map((f) => {
      const nullable = f.nullable ? "" : "!";
      const directives: string[] = [];

      if (EXTERNAL_FIELDS.get(type)?.has(f.name)) directives.push("@external");
      const provides = PROVIDES_FIELDS.get(type)?.get(f.name);
      if (provides) directives.push(`@provides(fields: "${provides}")`);
      const requires = REQUIRES_FIELDS.get(type)?.get(f.name);
      if (requires) directives.push(`@requires(fields: "${requires}")`);

      const directiveStr = directives.length ? ` ${directives.join(" ")}` : "";
      return `  ${f.name}: ${f.type}${nullable}${directiveStr}`;
    });

    lines.push(`${typeLine} {\n${fieldLines.join("\n")}\n}`);
  }

  // Add Query/Mutation types from resolvers using the standard builder
  const baseSdl = buildSchemaFromDecorators([], resolvers);
  // Extract just the Query/Mutation/Subscription blocks (skip empty types)
  const blocks = baseSdl
    .split("\n\n")
    .filter(
      (b: string) =>
        b.startsWith("type Query") ||
        b.startsWith("type Mutation") ||
        b.startsWith("type Subscription"),
    );
  lines.push(...blocks);

  return `${lines.join("\n\n")}\n`;
}
