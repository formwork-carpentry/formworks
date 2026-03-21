/**
 * @module @formwork/graphql
 * @description Tests for code-first GraphQL decorators and SDL generation.
 *
 * Test strategy:
 * - Decorators applied as function calls (vitest uses rolldown which doesn't support
 *   TC39 decorator syntax directly in test files)
 * - clearRegistries() before each test to prevent cross-test pollution
 * - Tests cover: type registration, field options, resolver methods, arg parsing, SDL output
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ObjectType, Field, Resolver, Query, Mutation, Subscription, Arg,
  getTypeMetadata, getResolverMetadata, getAllTypes, getAllResolvers,
  clearRegistries, buildSchemaFromDecorators,
} from '../src/decorators.js';

describe('@formwork/graphql: Code-First Decorators', () => {
  beforeEach(() => clearRegistries());

  describe('@ObjectType + @Field', () => {
    it('registers a type with its fields', () => {
      class Post { id!: string; title!: string; body?: string; views!: number; }
      ObjectType({ description: 'A blog post' })(Post);
      Field('ID')(Post.prototype, 'id');
      Field('String')(Post.prototype, 'title');
      Field('String', { nullable: true })(Post.prototype, 'body');
      Field('Int')(Post.prototype, 'views');

      const meta = getTypeMetadata(Post)!;
      expect(meta.name).toBe('Post');
      expect(meta.description).toBe('A blog post');
      expect(meta.fields.size).toBe(4);
      expect(meta.fields.get('id')!.type).toBe('ID');
      expect(meta.fields.get('id')!.nullable).toBe(false);
      expect(meta.fields.get('body')!.nullable).toBe(true);
      expect(meta.fields.get('views')!.type).toBe('Int');
    });

    it('supports custom type name', () => {
      class Post { id!: string; }
      ObjectType({ name: 'BlogPost' })(Post);
      Field('ID')(Post.prototype, 'id');
      expect(getTypeMetadata(Post)!.name).toBe('BlogPost');
    });

    it('supports @deprecated fields', () => {
      class User { name!: string; fullName!: string; }
      ObjectType()(User);
      Field('String', { deprecation: 'Use fullName' })(User.prototype, 'name');
      Field('String')(User.prototype, 'fullName');
      expect(getTypeMetadata(User)!.fields.get('name')!.deprecation).toBe('Use fullName');
    });

    it('getAllTypes returns all registered types', () => {
      class A { x!: string; }
      class B { y!: string; }
      ObjectType()(A); Field('String')(A.prototype, 'x');
      ObjectType()(B); Field('String')(B.prototype, 'y');
      expect(getAllTypes().size).toBe(2);
    });
  });

  describe('@Resolver + @Query + @Mutation + @Subscription + @Arg', () => {
    it('registers query methods with arguments', () => {
      class R { async getPost(_id: string) {} async listPosts() {} }
      Resolver('Post')(R);
      Query('Post', { name: 'post' })(R.prototype, 'getPost', Object.getOwnPropertyDescriptor(R.prototype, 'getPost')!);
      Arg('id', 'ID')(R.prototype, 'getPost', 0);
      Query('[Post]', { name: 'posts' })(R.prototype, 'listPosts', Object.getOwnPropertyDescriptor(R.prototype, 'listPosts')!);

      const meta = getResolverMetadata(R)!;
      expect(meta.forType).toBe('Post');
      expect(meta.methods.get('getPost')!.name).toBe('post');
      expect(meta.methods.get('getPost')!.type).toBe('query');
      expect(meta.methods.get('getPost')!.returnType).toBe('Post');
      expect(meta.methods.get('getPost')!.args.get('id')!.type).toBe('ID');
    });

    it('registers mutations with multiple args', () => {
      class R { async create(_t: string, _b?: string) {} }
      Resolver()(R);
      Mutation('Post')(R.prototype, 'create', Object.getOwnPropertyDescriptor(R.prototype, 'create')!);
      Arg('title', 'String')(R.prototype, 'create', 0);
      Arg('body', 'String', { nullable: true })(R.prototype, 'create', 1);

      const m = getResolverMetadata(R)!.methods.get('create')!;
      expect(m.type).toBe('mutation');
      expect(m.args.get('title')!.nullable).toBe(false);
      expect(m.args.get('body')!.nullable).toBe(true);
    });

    it('registers subscriptions', () => {
      class R { async onMsg() {} }
      Resolver()(R);
      Subscription('Message')(R.prototype, 'onMsg', Object.getOwnPropertyDescriptor(R.prototype, 'onMsg')!);
      expect(getResolverMetadata(R)!.methods.get('onMsg')!.type).toBe('subscription');
    });

    it('supports default values for args', () => {
      class R { async list(_limit: number) {} }
      Resolver()(R);
      Query('[Post]')(R.prototype, 'list', Object.getOwnPropertyDescriptor(R.prototype, 'list')!);
      Arg('limit', 'Int', { defaultValue: 10 })(R.prototype, 'list', 0);

      const arg = getResolverMetadata(R)!.methods.get('list')!.args.get('limit')!;
      expect(arg.defaultValue).toBe(10);
    });

    it('getAllResolvers returns all registered resolvers', () => {
      class A { async x() {} }
      class B { async y() {} }
      Resolver()(A); Query('X')(A.prototype, 'x', Object.getOwnPropertyDescriptor(A.prototype, 'x')!);
      Resolver()(B); Query('Y')(B.prototype, 'y', Object.getOwnPropertyDescriptor(B.prototype, 'y')!);
      expect(getAllResolvers().size).toBe(2);
    });
  });

  describe('buildSchemaFromDecorators', () => {
    it('generates complete SDL with types, queries, and mutations', () => {
      class User { id!: string; name!: string; email!: string; }
      ObjectType({ description: 'A user account' })(User);
      Field('ID')(User.prototype, 'id');
      Field('String')(User.prototype, 'name');
      Field('String')(User.prototype, 'email');

      class R {
        async getUser(_id: string) {}
        async listUsers() {}
        async createUser(_n: string, _e: string) {}
      }
      Resolver('User')(R);
      Query('User', { name: 'user' })(R.prototype, 'getUser', Object.getOwnPropertyDescriptor(R.prototype, 'getUser')!);
      Arg('id', 'ID')(R.prototype, 'getUser', 0);
      Query('[User]', { name: 'users' })(R.prototype, 'listUsers', Object.getOwnPropertyDescriptor(R.prototype, 'listUsers')!);
      Mutation('User', { name: 'createUser' })(R.prototype, 'createUser', Object.getOwnPropertyDescriptor(R.prototype, 'createUser')!);
      Arg('name', 'String')(R.prototype, 'createUser', 0);
      Arg('email', 'String')(R.prototype, 'createUser', 1);

      const sdl = buildSchemaFromDecorators([User], [R]);

      expect(sdl).toContain('"""A user account"""');
      expect(sdl).toContain('type User {');
      expect(sdl).toContain('id: ID!');
      expect(sdl).toContain('name: String!');
      expect(sdl).toContain('type Query {');
      expect(sdl).toContain('user(id: ID!): User');
      expect(sdl).toContain('users: [User]');
      expect(sdl).toContain('type Mutation {');
      expect(sdl).toContain('createUser(name: String!, email: String!): User');
    });

    it('handles empty resolvers (types only)', () => {
      class Tag { id!: string; label!: string; }
      ObjectType()(Tag);
      Field('ID')(Tag.prototype, 'id');
      Field('String')(Tag.prototype, 'label');

      const sdl = buildSchemaFromDecorators([Tag], []);
      expect(sdl).toContain('type Tag {');
      expect(sdl).not.toContain('type Query');
    });

    it('includes deprecated field annotation', () => {
      class X { old!: string; }
      ObjectType()(X);
      Field('String', { deprecation: 'Use newField' })(X.prototype, 'old');

      const sdl = buildSchemaFromDecorators([X], []);
      expect(sdl).toContain('@deprecated(reason: "Use newField")');
    });
  });
});
