import { describe, it, expect } from 'vitest';
import { TenantStorageScope } from '../../src/tenancy/scope.js';
import type { Tenant } from '../../src/tenancy/types.js';

describe('tenancy/TenantStorageScope', () => {
  const tenant: Tenant = {
    id: 'acme',
    name: 'Acme Corp',
    slug: 'acme',
    domain: 'acme.example.com',
    status: 'active' as const,
  };

  it('prefixes storage paths', async () => {
    const paths: string[] = [];
    const mockStorage = {
      async put(path: string, _content: Buffer | string) {
        paths.push(path);
      },
      async get(path: string) {
        paths.push(path);
        return Buffer.from('');
      },
      async exists(path: string) {
        paths.push(path);
        return true;
      },
      async delete(path: string) {
        paths.push(path);
        return true;
      },
    };

    const scoped = new TenantStorageScope(mockStorage, tenant);
    await scoped.put('avatars/photo.png', 'data');
    await scoped.get('docs/report.pdf');
    await scoped.exists('config.json');
    await scoped.delete('temp.txt');

    expect(paths).toEqual([
      'tenants/acme/avatars/photo.png',
      'tenants/acme/docs/report.pdf',
      'tenants/acme/config.json',
      'tenants/acme/temp.txt',
    ]);
    expect(scoped.getPrefix()).toBe('tenants/acme/');
  });
});
