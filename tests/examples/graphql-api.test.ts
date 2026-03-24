import { describe, expect, it } from 'vitest';

describe('Example: graphql-api', () => {
  it('creates app with schema', async () => {
    const { createApp } = await import('../../../examples/graphql-api/src/app.ts');
    const { kernel, schema } = await createApp();
    expect(kernel).toBeDefined();
    expect(schema.getType('User')).toBeDefined();
  });
});
