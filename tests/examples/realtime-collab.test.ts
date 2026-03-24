import { describe, expect, it } from 'vitest';

describe('Example: realtime-collab', () => {
  it('creates app with doc store', async () => {
    const { createApp } = await import('../../../examples/realtime-collab/src/app.ts');
    const { kernel, docs } = await createApp();
    expect(kernel).toBeDefined();
    expect(docs).toBeDefined();
  });
});
