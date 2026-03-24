/**
 * @module tests
 * @description Smoke tests for all 11 example applications.
 * Each test verifies the app can be imported and its createApp/kernel works.
 */

import { describe, it, expect } from 'vitest';

describe('Example: blog-api', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/blog-api/src/app.ts');
    const { kernel, config } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('Blog API');
  });
});

describe('Example: blog-app', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/blog-app/src/app.ts');
    const { kernel, config } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('Carpenter Blog');
  });
});

describe('Example: api-only', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/api-only/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});

describe('Example: minimal-api', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/minimal-api/src/app.ts');
    const kernel = await createApp();
    expect(kernel).toBeDefined();
  });
});

describe('Example: fullstack-react', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/fullstack-react/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});

describe('Example: edge-app', () => {
  it('exports EdgeKernel with routes', async () => {
    const { kernel } = await import('../../examples/edge-app/src/app.ts');
    expect(kernel.getRouteCount()).toBeGreaterThan(0);
  });

  it('handles health check', async () => {
    const { kernel } = await import('../../examples/edge-app/src/app.ts');
    const res = await kernel.handle(new Request('http://localhost/health'));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });
});

describe('Example: polyglot-timetable', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/polyglot-timetable/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});

describe('Example: saas-starter', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/saas/src/app.ts');
    const { kernel, config } = await createApp();
    expect(kernel).toBeDefined();
    expect(config.get('app.name')).toBe('SaaS Starter');
  });
});

describe('Example: queue-example', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/queue-example/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});

describe('Example: mail-example', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/mail-example/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});

describe('Example: storage-example', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/storage-example/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});

describe('Example: database-example', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/database-example/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});

describe('Example: ai-assistant', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../examples/ai-assistant/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});

describe('Example: graphql-api', () => {
  it('creates app with schema', async () => {
    const { createApp } = await import('../../examples/graphql-api/src/app.ts');
    const { kernel, schema } = await createApp();
    expect(kernel).toBeDefined();
    expect(schema.getType('User')).toBeDefined();
  });
});

describe('Example: realtime-collab', () => {
  it('creates app with doc store', async () => {
    const { createApp } = await import('../../examples/realtime-collab/src/app.ts');
    const { kernel, docs } = await createApp();
    expect(kernel).toBeDefined();
    expect(docs).toBeDefined();
  });
});
