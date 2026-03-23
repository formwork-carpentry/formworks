/**
 * @module @carpentry/auth
 * @description Tests for JwtGuard, createToken, verifyToken
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  JwtGuard, createToken, verifyToken,
  InMemoryUserProvider, SimpleUser,
} from '../src/index.js';
import type { JwtConfig } from '../src/index.js';

const SECRET = 'test-secret-key-at-least-32-characters-long!!';
const config: JwtConfig = { secret: SECRET, expiresIn: 3600, issuer: 'carpenter-test' };

describe('JWT Utilities', () => {
  describe('createToken + verifyToken', () => {
    it('creates a valid token', async () => {
      const token = await createToken({ sub: 'user-1' }, config);
      expect(token.split('.')).toHaveLength(3);
    });

    it('verifies a valid token', async () => {
      const token = await createToken({ sub: 42 }, config);
      const result = await verifyToken(token, config);
      expect(result.valid).toBe(true);
      expect(result.payload?.sub).toBe(42);
    });

    it('includes iat and exp claims', async () => {
      const token = await createToken({ sub: 'u1' }, config);
      const result = await verifyToken(token, config);
      expect(result.payload?.iat).toBeTypeOf('number');
      expect(result.payload?.exp).toBeTypeOf('number');
      expect(result.payload!.exp - result.payload!.iat).toBe(3600);
    });

    it('includes issuer claim', async () => {
      const token = await createToken({ sub: 'u1' }, config);
      const result = await verifyToken(token, config);
      expect(result.payload?.iss).toBe('carpenter-test');
    });

    it('rejects token with wrong secret', async () => {
      const token = await createToken({ sub: 'u1' }, config);
      const result = await verifyToken(token, { ...config, secret: 'wrong-secret-key-also-32-chars!!' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('rejects expired token', async () => {
      const expired = await createToken({ sub: 'u1' }, { ...config, expiresIn: -10 });
      const result = await verifyToken(expired, config);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('rejects token with wrong issuer', async () => {
      const token = await createToken({ sub: 'u1' }, { ...config, issuer: 'other' });
      const result = await verifyToken(token, config);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid issuer');
    });

    it('rejects malformed token', async () => {
      const result = await verifyToken('not.a.jwt', config);
      expect(result.valid).toBe(false);
    });

    it('preserves custom claims', async () => {
      const token = await createToken({ sub: 'u1', role: 'admin', org: 'acme' }, config);
      const result = await verifyToken(token, config);
      expect(result.payload?.role).toBe('admin');
      expect(result.payload?.org).toBe('acme');
    });
  });
});

describe('JwtGuard', () => {
  let provider: InMemoryUserProvider;
  let guard: JwtGuard;

  beforeEach(() => {
    provider = new InMemoryUserProvider();
    provider.addUser(new SimpleUser(1, 'alice@example.com', 'secret123', 'admin'));
    provider.addUser(new SimpleUser(2, 'bob@example.com', 'password', 'user'));
    guard = new JwtGuard(provider, config);
  });

  describe('initial state', () => {
    it('starts as guest', async () => {
      expect(await guard.guest()).toBe(true);
      expect(await guard.check()).toBe(false);
      expect(await guard.user()).toBeNull();
      expect(await guard.id()).toBeNull();
      expect(guard.getToken()).toBeNull();
    });
  });

  describe('login', () => {
    it('logs in a user and generates token', async () => {
      const alice = new SimpleUser(1, 'alice@example.com', 'secret123');
      await guard.login(alice);

      expect(await guard.check()).toBe(true);
      expect(await guard.guest()).toBe(false);
      expect(await guard.id()).toBe(1);
      expect(guard.getToken()).toBeTruthy();
      expect(guard.getToken()!.split('.')).toHaveLength(3);
    });
  });

  describe('logout', () => {
    it('clears user and token', async () => {
      await guard.login(new SimpleUser(1, 'alice@example.com', 'x'));
      await guard.logout();

      expect(await guard.check()).toBe(false);
      expect(guard.getToken()).toBeNull();
    });
  });

  describe('attempt', () => {
    it('authenticates with valid credentials', async () => {
      const success = await guard.attempt({ email: 'alice@example.com', password: 'secret123' });
      expect(success).toBe(true);
      expect(await guard.check()).toBe(true);
      expect(await guard.id()).toBe(1);
      expect(guard.getToken()).toBeTruthy();
    });

    it('fails with wrong password', async () => {
      const success = await guard.attempt({ email: 'alice@example.com', password: 'wrong' });
      expect(success).toBe(false);
      expect(await guard.check()).toBe(false);
    });

    it('fails with unknown email', async () => {
      const success = await guard.attempt({ email: 'unknown@example.com', password: 'x' });
      expect(success).toBe(false);
    });
  });

  describe('authenticateToken', () => {
    it('authenticates from a valid token', async () => {
      // Login to get a token
      await guard.login(new SimpleUser(1, 'alice@example.com', 'x'));
      const token = guard.getToken()!;

      // Create a fresh guard and authenticate with the token
      const guard2 = new JwtGuard(provider, config);
      const success = await guard2.authenticateToken(token);
      expect(success).toBe(true);
      expect(await guard2.id()).toBe(1);
    });

    it('rejects an invalid token', async () => {
      const success = await guard.authenticateToken('garbage.token.here');
      expect(success).toBe(false);
      expect(await guard.check()).toBe(false);
    });

    it('rejects token for deleted user', async () => {
      const token = await createToken({ sub: 999 }, config);
      const success = await guard.authenticateToken(token);
      expect(success).toBe(false);
    });
  });
});
