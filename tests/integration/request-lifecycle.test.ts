import { describe, it, expect, beforeEach } from 'vitest';
import { TestResponse } from '../../src/testing/index.js';
import { createIntegrationHarness, createRequest } from './support.js';

describe('integration/request-lifecycle', () => {
  let harness: ReturnType<typeof createIntegrationHarness>;

  beforeEach(() => {
    harness = createIntegrationHarness();
  });

  it('runs create to cache to read lifecycle', async () => {
    const eventLog: string[] = [];
    harness.events.on('user.created', (payload) => {
      eventLog.push(`user.created:${(payload as { name: string }).name}`);
    });

    harness.db.queueResult([], 1, 1);
    const createRes = await harness.kernel.handle(
      createRequest('POST', 'http://localhost/api/users', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
      }),
    );

    const created = TestResponse.from(createRes);
    created.assertCreated();
    created.assertJsonHas('data');
    expect(eventLog).toEqual(['user.created:Alice']);

    harness.db.queueResult([{ id: 1, name: 'Alice', email: 'alice@example.com' }]);
    const firstRead = await harness.kernel.handle(createRequest('GET', 'http://localhost/api/users'));
    TestResponse.from(firstRead).assertOk();
    expect(firstRead.getBody()).toEqual({
      data: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
      source: 'db',
    });

    const secondRead = await harness.kernel.handle(createRequest('GET', 'http://localhost/api/users'));
    TestResponse.from(secondRead).assertOk();
    expect(secondRead.getBody()).toEqual({
      data: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
      source: 'cache',
    });

    expect(harness.db.executedQueries.length).toBe(2);
  });

  it('returns 422 for invalid input', async () => {
    const res = await harness.kernel.handle(
      createRequest('POST', 'http://localhost/api/users', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', email: 'not-an-email' }),
      }),
    );

    const test = TestResponse.from(res);
    test.assertUnprocessable();
    test.assertJsonHas('errors');

    const body = res.getBody() as { errors: Record<string, string[]> };
    expect(body.errors['name']).toBeDefined();
    expect(body.errors['email']).toBeDefined();
    harness.db.assertQueryCount(0);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await harness.kernel.handle(createRequest('GET', 'http://localhost/api/nonexistent'));
    TestResponse.from(res).assertNotFound();
  });
});
