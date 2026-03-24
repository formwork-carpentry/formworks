import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import {
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
} from '../src/federation.js';
import { ObjectType, Field, clearRegistries } from '../src/decorators.js';

describe('graphql/federation', () => {
  beforeEach(() => {
    clearRegistries();
    clearFederationRegistries();
  });

  describe('directives metadata', () => {
    it('registers keys and supports multiple/composite values', () => {
      class Product {
        id!: string;
        sku!: string;
      }

      FederationKey('id sku')(Product);
      FederationKey('id')(Product);
      FederationKey('sku')(Product);

      expect(getFederationKeys(Product)).toEqual(['id sku', 'id', 'sku']);
    });

    it('tracks external/provides/requires metadata', () => {
      class Review {
        author!: unknown;
      }
      class Product {
        shippingCost!: number;
      }

      External()(Review.prototype, 'author');
      Provides('name email')(Review.prototype, 'author');
      Requires('price weight')(Product.prototype, 'shippingCost');

      expect(isExternalField(Review, 'author')).toBe(true);
      expect(isExternalField(Review, 'body')).toBe(false);
      expect(getProvides(Review, 'author')).toBe('name email');
      expect(getRequires(Product, 'shippingCost')).toBe('price weight');
    });
  });

  describe('buildFederatedSchema', () => {
    it('generates @key directives', () => {
      class User {
        id!: string;
        name!: string;
      }
      ObjectType()(User);
      Field('ID')(User.prototype, 'id');
      Field('String')(User.prototype, 'name');
      FederationKey('id')(User);

      const sdl = buildFederatedSchema([User], []);
      expect(sdl).toContain('extend schema @link');
      expect(sdl).toContain('type User @key(fields: "id")');
      expect(sdl).toContain('id: ID!');
      expect(sdl).toContain('name: String!');
    });

    it('renders @external and @provides directives', () => {
      class Review {
        id!: string;
        author!: unknown;
      }
      ObjectType()(Review);
      Field('ID')(Review.prototype, 'id');
      Field('User')(Review.prototype, 'author');
      FederationKey('id')(Review);
      External()(Review.prototype, 'author');
      Provides('name')(Review.prototype, 'author');

      const sdl = buildFederatedSchema([Review], []);
      expect(sdl).toContain('author: User! @external');
      expect(sdl).toContain('@provides(fields: "name")');
    });
  });
});
