import { describe, expect, it } from 'vitest';

import {
  ChainResolver,
  DomainResolver,
  HeaderResolver,
  PathResolver,
  SubdomainResolver,
} from '../../src/tenancy/resolvers.js';

describe('tenancy/resolvers', () => {
  it('resolves from subdomain with base domain guardrails', async () => {
    const resolver = new SubdomainResolver('example.com');

    expect(await resolver.resolve({ hostname: 'acme.example.com', path: '/', headers: {} })).toBe('acme');
    expect(await resolver.resolve({ hostname: 'example.com', path: '/', headers: {} })).toBeNull();
    expect(await resolver.resolve({ hostname: 'www.example.com', path: '/', headers: {} })).toBeNull();
    expect(await resolver.resolve({ hostname: 'other.dev', path: '/', headers: {} })).toBeNull();
  });

  it('resolves from path with optional prefix', async () => {
    const plain = new PathResolver();
    const prefixed = new PathResolver('/tenant');

    expect(await plain.resolve({ path: '/acme/dashboard', headers: {} })).toBe('acme');
    expect(await prefixed.resolve({ path: '/tenant/atlas/dashboard', headers: {} })).toBe('atlas');
    expect(await prefixed.resolve({ path: '/tenant', headers: {} })).toBeNull();
  });

  it('resolves from lowercase header name', async () => {
    const resolver = new HeaderResolver('X-Tenant-Id');

    expect(await resolver.resolve({ headers: { 'x-tenant-id': 'north' } })).toBe('north');
    expect(await resolver.resolve({ headers: {} })).toBeNull();
  });

  it('resolves from explicit domain mappings', async () => {
    const resolver = new DomainResolver()
      .addMapping('foo.example.com', 'foo')
      .addMapping('bar.example.com', 'bar');

    expect(await resolver.resolve({ hostname: 'foo.example.com', headers: {} })).toBe('foo');
    expect(await resolver.resolve({ hostname: 'missing.example.com', headers: {} })).toBeNull();
  });

  it('returns first non-null result in chain order', async () => {
    const resolver = new ChainResolver([
      new HeaderResolver('x-tenant-id'),
      new SubdomainResolver('example.com'),
      new PathResolver(),
    ]);

    const fromHeader = await resolver.resolve({
      hostname: 'acme.example.com',
      path: '/pathTenant/dashboard',
      headers: { 'x-tenant-id': 'headerTenant' },
    });
    const fromSubdomain = await resolver.resolve({
      hostname: 'acme.example.com',
      path: '/pathTenant/dashboard',
      headers: {},
    });

    expect(fromHeader).toBe('headerTenant');
    expect(fromSubdomain).toBe('acme');
  });
});
