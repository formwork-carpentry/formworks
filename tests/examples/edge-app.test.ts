import { describe, expect, it } from 'vitest';

describe('Example: edge-app', () => {
  it('exports EdgeKernel with routes', async () => {
    const { kernel } = await import('../../../examples/edge-app/src/app.ts');
    expect(kernel.getRouteCount()).toBeGreaterThan(0);
  });

  it('handles health check', async () => {
    const { kernel } = await import('../../../examples/edge-app/src/app.ts');
    const res = await kernel.handle(new Request('http://localhost/health'));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });
});
