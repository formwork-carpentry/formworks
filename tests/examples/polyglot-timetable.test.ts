import { describe, expect, it } from 'vitest';

describe('Example: polyglot-timetable', () => {
  it('creates app', async () => {
    const { createApp } = await import('../../../examples/polyglot-timetable/src/app.ts');
    const { kernel } = await createApp();
    expect(kernel).toBeDefined();
  });
});
