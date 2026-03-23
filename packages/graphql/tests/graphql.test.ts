import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaBuilder, DataLoader } from '../src/index.js';

describe('@carpentry/graphql: SchemaBuilder', () => {
  let schema: SchemaBuilder;

  beforeEach(() => {
    schema = new SchemaBuilder();
  });

  describe('query execution', () => {
    it('resolves a simple query', async () => {
      schema.query('hello', {
        type: 'String',
        resolve: () => 'world',
      });

      const result = await schema.execute('{ hello }');
      expect(result.data).toEqual({ hello: 'world' });
      expect(result.errors).toBeUndefined();
    });

    it('resolves with arguments', async () => {
      schema.query('greet', {
        type: 'String',
        resolve: (_p, args) => `Hello, ${args['name']}!`,
      });

      const result = await schema.execute('{ greet(name: "Alice") }');
      expect(result.data).toEqual({ greet: 'Hello, Alice!' });
    });

    it('resolves async resolvers', async () => {
      schema.query('asyncData', {
        type: 'String',
        resolve: async () => {
          await new Promise((r) => setTimeout(r, 5));
          return 'async result';
        },
      });

      const result = await schema.execute('{ asyncData }');
      expect(result.data).toEqual({ asyncData: 'async result' });
    });

    it('resolves multiple fields', async () => {
      schema.query('a', { type: 'Int', resolve: () => 1 });
      schema.query('b', { type: 'Int', resolve: () => 2 });

      const result = await schema.execute('{ a b }');
      expect(result.data).toEqual({ a: 1, b: 2 });
    });

    it('returns error for unknown field', async () => {
      const result = await schema.execute('{ unknown }');
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('unknown');
    });

    it('catches resolver errors', async () => {
      schema.query('boom', {
        type: 'String',
        resolve: () => { throw new Error('Resolver failed'); },
      });

      const result = await schema.execute('{ boom }');
      expect(result.errors![0].message).toBe('Resolver failed');
    });
  });

  describe('mutations', () => {
    it('executes a mutation', async () => {
      schema.mutation('createUser', {
        type: 'User',
        resolve: (_p, args) => ({ id: 1, name: args['name'] }),
      });

      const result = await schema.execute('mutation { createUser(name: "Alice") }');
      expect(result.data).toEqual({ createUser: { id: 1, name: 'Alice' } });
    });
  });

  describe('middleware', () => {
    it('wraps resolvers', async () => {
      const log: string[] = [];

      schema.use((resolve) => async (parent, args, ctx) => {
        log.push('before');
        const result = await resolve(parent, args, ctx);
        log.push('after');
        return result;
      });

      schema.query('data', { type: 'String', resolve: () => { log.push('resolve'); return 'ok'; } });
      await schema.execute('{ data }');

      expect(log).toEqual(['before', 'resolve', 'after']);
    });
  });

  describe('type definitions', () => {
    it('registers and retrieves types', () => {
      schema.type('User', {
        id: { type: 'ID' },
        name: { type: 'String' },
        email: { type: 'String' },
      });

      const t = schema.getType('User');
      expect(t).toBeDefined();
      expect(t!.name).toBe('User');
      expect(Object.keys(t!.fields)).toEqual(['id', 'name', 'email']);
    });

    it('getQueries() and getMutations()', () => {
      schema.query('users', { type: '[User]', resolve: () => [] });
      schema.mutation('createUser', { type: 'User', resolve: () => ({}) });

      expect(schema.getQueries()).toEqual(['users']);
      expect(schema.getMutations()).toEqual(['createUser']);
    });
  });

  describe('toSDL()', () => {
    it('generates SDL string', () => {
      schema.type('User', { id: { type: 'ID' }, name: { type: 'String' } });
      schema.query('users', { type: '[User]', resolve: () => [] });

      const sdl = schema.toSDL();
      expect(sdl).toContain('type User');
      expect(sdl).toContain('id: ID');
      expect(sdl).toContain('type Query');
      expect(sdl).toContain('users: [User]');
    });
  });

  describe('context passing', () => {
    it('passes context to resolvers', async () => {
      schema.query('whoami', {
        type: 'String',
        resolve: (_p, _a, ctx) => `User: ${ctx['userId']}`,
      });

      const result = await schema.execute('{ whoami }', undefined, { userId: 42 });
      expect(result.data).toEqual({ whoami: 'User: 42' });
    });
  });

  describe('variables', () => {
    it('merges variables into args', async () => {
      schema.query('user', {
        type: 'User',
        resolve: (_p, args) => ({ id: args['id'] }),
      });

      const result = await schema.execute('{ user }', { id: 5 });
      expect(result.data).toEqual({ user: { id: 5 } });
    });
  });
});

describe('@carpentry/graphql: DataLoader', () => {
  it('batches multiple loads into single call', async () => {
    let batchCalls = 0;
    const loader = new DataLoader<number, string>(async (keys) => {
      batchCalls++;
      return keys.map((k) => `value-${k}`);
    });

    // Load multiple keys in same tick
    const [a, b, c] = await Promise.all([
      loader.load(1),
      loader.load(2),
      loader.load(3),
    ]);

    expect(a).toBe('value-1');
    expect(b).toBe('value-2');
    expect(c).toBe('value-3');
    expect(batchCalls).toBe(1); // ONE batch call, not 3
  });

  it('caches results', async () => {
    let calls = 0;
    const loader = new DataLoader<number, string>(async (keys) => {
      calls++;
      return keys.map((k) => `v-${k}`);
    });

    await loader.load(1);
    await loader.load(1); // should be cached

    expect(calls).toBe(1);
  });

  it('loadMany()', async () => {
    const loader = new DataLoader<number, string>(async (keys) =>
      keys.map((k) => `item-${k}`)
    );

    const results = await loader.loadMany([10, 20, 30]);
    expect(results).toEqual(['item-10', 'item-20', 'item-30']);
  });

  it('handles null results', async () => {
    const loader = new DataLoader<number, string>(async (keys) =>
      keys.map((k) => (k === 2 ? null : `v-${k}`))
    );

    const [a, b, c] = await Promise.all([
      loader.load(1),
      loader.load(2),
      loader.load(3),
    ]);

    expect(a).toBe('v-1');
    expect(b).toBeNull();
    expect(c).toBe('v-3');
  });

  it('clear() resets cache', async () => {
    let calls = 0;
    const loader = new DataLoader<number, string>(async (keys) => {
      calls++;
      return keys.map((k) => `v-${k}-${calls}`);
    });

    await loader.load(1);
    loader.clear();
    const result = await loader.load(1); // should re-fetch

    expect(calls).toBe(2);
    expect(result).toBe('v-1-2');
  });
});
