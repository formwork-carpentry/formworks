/**
 * @module @formwork/core/contracts/graphql
 * @description GraphQL contracts - schema, type definition, and resolver interfaces.
 *
 * Implementations: SchemaBuilder, DataLoader, PubSub
 *
 * @example
 * ```ts
 * const schema = new SchemaBuilder();
 * schema.type('User', { id: { type: 'ID' }, name: { type: 'String' } });
 * schema.query('user', { type: 'User', resolve: (_, args) => User.find(args.id) });
 * ```
 */
export {};
//# sourceMappingURL=index.js.map