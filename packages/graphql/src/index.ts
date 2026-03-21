/**
 * @module @formwork/graphql
 * @description GraphQL schema builder, resolver registry, DataLoader for N+1 prevention
 * @patterns Builder (schema), Registry (resolvers), Proxy (DataLoader batching)
 * @principles SRP — schema definition only; OCP — new types/resolvers via register
 *
 * Use this package to:
 * - Define a lightweight schema with {@link SchemaBuilder}
 * - Execute queries against your resolvers using `SchemaBuilder.execute()`
 * - Batch data fetching with {@link DataLoader}
 *
 * @example
 * ```ts
 * import { SchemaBuilder } from '@formwork/graphql';
 *
 * const schema = new SchemaBuilder()
 *   .query('hello', {
 *     type: 'String',
 *     resolve: () => 'world',
 *   });
 *
 * const res = await schema.execute('{ hello }');
 * // res.data?.hello === 'world'
 * ```
 */

// ── Local Types ───────────────────────────────────────────

export interface GraphQLContext {
  [key: string]: unknown;
}
export interface GraphQLResult {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}
type Dictionary = Record<string, unknown>;

export interface FieldDefinition {
  type: string;
  description?: string;
  args?: Record<string, { type: string; defaultValue?: unknown }>;
  resolve?: ResolverFn;
}

export type ResolverFn = (
  parent: unknown,
  args: Dictionary,
  context: GraphQLContext,
) => unknown | Promise<unknown>;

export interface TypeDefinition {
  name: string;
  description?: string;
  fields: Record<string, FieldDefinition>;
}

// ── Schema Builder ────────────────────────────────────────

/**
 * SchemaBuilder — define a small GraphQL-like schema and execute it against in-memory resolvers.
 *
 * This is intentionally lightweight: it supports `query`/`mutation` fields and a minimal query
 * parser (`{ fieldName }` / `{ fieldName(arg: value) }` style) to enable DX and testing.
 *
 * @example
 * ```ts
 * const schema = new SchemaBuilder()
 *   .query('hello', {
 *     type: 'String',
 *     resolve: () => 'world',
 *   });
 *
 * const res = await schema.execute('{ hello }');
 * // res.data?.hello === 'world'
 * ```
 */
export class SchemaBuilder {
  private types = new Map<string, TypeDefinition>();
  private queryFields = new Map<string, FieldDefinition>();
  private mutationFields = new Map<string, FieldDefinition>();
  private middlewareFns: Array<(resolve: ResolverFn) => ResolverFn> = [];

  /**
   * @param {string} name
   * @param {Record<string, FieldDefinition>} fields
   * @param {string} [description]
   * @returns {this}
   */
  type(name: string, fields: Record<string, FieldDefinition>, description?: string): this {
    this.types.set(name, { name, fields, description });
    return this;
  }

  /**
   * @param {string} name
   * @param {FieldDefinition} field
   * @returns {this}
   */
  query(name: string, field: FieldDefinition): this {
    this.queryFields.set(name, field);
    return this;
  }

  /**
   * @param {string} name
   * @param {FieldDefinition} field
   * @returns {this}
   */
  mutation(name: string, field: FieldDefinition): this {
    this.mutationFields.set(name, field);
    return this;
  }

  /**
   * @param {(resolve: ResolverFn} middleware
   * @returns {this}
   */
  use(middleware: (resolve: ResolverFn) => ResolverFn): this {
    this.middlewareFns.push(middleware);
    return this;
  }

  /**
   * @param {string} query
   * @param {Dictionary} [variables]
   * @param {GraphQLContext} [context]
   * @returns {Promise<GraphQLResult>}
   */
  async execute(
    query: string,
    variables?: Dictionary,
    context?: GraphQLContext,
  ): Promise<GraphQLResult> {
    const ctx: GraphQLContext = context ?? {};
    const parsed = this.parseSimpleQuery(query);

    if (!parsed) return { errors: [{ message: "Failed to parse query." }] };

    try {
      const data: Dictionary = {};

      for (const field of parsed.fields) {
        const resolver =
          parsed.operation === "mutation"
            ? this.mutationFields.get(field.name)
            : this.queryFields.get(field.name);

        if (!resolver?.resolve) return { errors: [{ message: `Unknown field: ${field.name}` }] };

        const args = { ...field.args, ...variables };
        let resolveFn = resolver.resolve;
        for (const mw of this.middlewareFns) resolveFn = mw(resolveFn);

        data[field.name] = await resolveFn(null, args, ctx);
      }

      return { data };
    } catch (error) {
      return { errors: [{ message: (error as Error).message }] };
    }
  }

  /**
   * @param {string} name
   * @returns {TypeDefinition | undefined}
   */
  getType(name: string): TypeDefinition | undefined {
    return this.types.get(name);
  }
  getQueries(): string[] {
    return [...this.queryFields.keys()];
  }
  getMutations(): string[] {
    return [...this.mutationFields.keys()];
  }

  toSDL(): string {
    const parts: string[] = [];
    for (const type of this.types.values()) {
      const fields = Object.entries(type.fields)
        .map(([n, f]) => `  ${n}: ${f.type}`)
        .join("\n");
      parts.push(`type ${type.name} {\n${fields}\n}`);
    }
    if (this.queryFields.size > 0) {
      const fields = [...this.queryFields.entries()]
        .map(([n, f]) => `  ${n}: ${f.type}`)
        .join("\n");
      parts.push(`type Query {\n${fields}\n}`);
    }
    if (this.mutationFields.size > 0) {
      const fields = [...this.mutationFields.entries()]
        .map(([n, f]) => `  ${n}: ${f.type}`)
        .join("\n");
      parts.push(`type Mutation {\n${fields}\n}`);
    }
    return parts.join("\n\n");
  }

  // ── Simple Query Parser ─────────────────────────────────

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: regex-based query parser with multiple token handling branches
  private parseSimpleQuery(query: string): ParsedQuery | null {
    const trimmed = query.trim();
    let operation: "query" | "mutation" = "query";
    let body = trimmed;
    if (trimmed.startsWith("mutation")) {
      operation = "mutation";
      body = trimmed.slice(8).trim();
    } else if (trimmed.startsWith("query")) {
      body = trimmed.slice(5).trim();
    }

    const match = body.match(/\{([\s\S]*)\}/);
    if (!match) return null;

    const fields: ParsedField[] = [];
    const fieldRegex = /(\w+)(?:\(([^)]*)\))?/g;
    let m: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop pattern
    while ((m = fieldRegex.exec(match[1].trim()))) {
      const fieldArgs: Dictionary = {};
      if (m[2]) {
        for (const pair of m[2].split(",")) {
          const [k, v] = pair.split(":").map((s) => s.trim());
          if (k && v) {
            const c = v.replace(/^["']|["']$/g, "");
            fieldArgs[k] = Number.isNaN(Number(c)) ? c : Number(c);
          }
        }
      }
      fields.push({ name: m[1], args: fieldArgs });
    }
    return { operation, fields };
  }
}

interface ParsedQuery {
  operation: "query" | "mutation";
  fields: ParsedField[];
}
interface ParsedField {
  name: string;
  args: Dictionary;
}

// ── DataLoader — batches N+1 loads ────────────────────────

/**
 * DataLoader — batch and cache async loads by key.
 *
 * Useful when many resolvers need the same piece of data (preventing N+1 calls).
 * Batches are dispatched in a microtask; `loadMany()` is provided for convenience.
 *
 * @example
 * ```ts
 * const loader = new DataLoader(async (ids) =>
 *   ids.map((id) => (id === 1 ? 'Alice' : null)),
 * );
 *
 * const [a] = await loader.loadMany([1]);
 * // a === 'Alice'
 * ```
 */
export class DataLoader<K = string | number, V = unknown> {
  private batch: Array<{ key: K; resolve: (value: V | null) => void }> = [];
  private cache = new Map<string, V | null>();
  private batchFn: (keys: K[]) => Promise<(V | null)[]>;
  private scheduled = false;

  constructor(batchFn: (keys: K[]) => Promise<(V | null)[]>) {
    this.batchFn = batchFn;
  }

  /**
   * @param {K} key
   * @returns {Promise<V | null>}
   */
  async load(key: K): Promise<V | null> {
    const ck = String(key);
    if (this.cache.has(ck)) return this.cache.get(ck) ?? null;
    return new Promise<V | null>((resolve) => {
      this.batch.push({ key, resolve });
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => this.dispatch());
      }
    });
  }

  /**
   * @param {K[]} keys
   * @returns {Promise<(V | null)[]>}
   */
  async loadMany(keys: K[]): Promise<(V | null)[]> {
    return Promise.all(keys.map((k) => this.load(k)));
  }
  clear(): void {
    this.cache.clear();
  }

  private async dispatch(): Promise<void> {
    this.scheduled = false;
    const current = [...this.batch];
    this.batch = [];
    if (current.length === 0) return;
    const values = await this.batchFn(current.map((b) => b.key));
    for (let i = 0; i < current.length; i++) {
      const v = values[i] ?? null;
      this.cache.set(String(current[i].key), v);
      current[i].resolve(v);
    }
  }
}

export {
  ObjectType,
  Field,
  Resolver,
  Query,
  Mutation,
  Subscription,
  Arg,
  getTypeMetadata,
  getResolverMetadata,
  getAllTypes,
  getAllResolvers,
  clearRegistries,
  buildSchemaFromDecorators,
} from "./decorators.js";
export {
  FederationKey,
  External,
  Provides,
  Requires,
  getFederationKeys,
  isExternalField,
  getProvides,
  getRequires,
  clearFederationRegistries,
  buildFederatedSchema,
} from "./federation.js";
export { PubSub } from "./PubSub.js";
export type { SubscriptionCallback, Unsubscribe } from "./PubSub.js";
