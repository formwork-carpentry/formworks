import { describe, it, expect } from 'vitest';
import { TestResponse, TestRequest, assertThrows, assertCompletesWithin, FakeClock } from '../src/index.js';

describe('@carpentry/testing: TestResponse', () => {
  const ok = new TestResponse(200, { id: 1, name: 'Alice' }, { 'content-type': 'application/json' });
  const err = new TestResponse(422, { errors: { name: ['Required'] } }, {});

  it('assertStatus()', () => { ok.assertStatus(200); });
  it('assertOk()', () => { ok.assertOk(); });
  it('assertCreated()', () => { new TestResponse(201, {}, {}).assertCreated(); });
  it('assertNotFound()', () => { new TestResponse(404, {}, {}).assertNotFound(); });
  it('assertUnprocessable()', () => { err.assertUnprocessable(); });
  it('assertStatus throws on mismatch', () => { expect(() => ok.assertStatus(404)).toThrow('404'); });

  it('assertJsonHas()', () => { ok.assertJsonHas('name'); });
  it('assertJsonHas throws on missing key', () => { expect(() => ok.assertJsonHas('email')).toThrow('email'); });
  it('assertJsonEquals()', () => { ok.assertJsonEquals({ id: 1, name: 'Alice' }); });
  it('assertJsonContains()', () => { ok.assertJsonContains({ name: 'Alice' }); });
  it('assertHeader()', () => { ok.assertHeader('content-type', 'application/json'); });
  it('assertValidationError()', () => { err.assertValidationError('name'); });
  it('getBody/getStatus/getHeaders', () => {
    expect(ok.getStatus()).toBe(200);
    expect(ok.getBody()).toEqual({ id: 1, name: 'Alice' });
    expect(ok.getHeaders()['content-type']).toBe('application/json');
  });
});

describe('@carpentry/testing: TestRequest', () => {
  it('builds GET request', () => {
    const req = TestRequest.get('/users').build();
    expect(req.method).toBe('GET');
    expect(req.url).toBe('http://localhost/users');
  });

  it('builds POST with JSON', () => {
    const req = TestRequest.post('/users').withJson({ name: 'Alice' }).build();
    expect(req.method).toBe('POST');
    expect(req.headers.get('content-type')).toBe('application/json');
  });

  it('adds auth token', () => {
    const req = TestRequest.get('/me').withToken('abc123').build();
    expect(req.headers.get('authorization')).toBe('Bearer abc123');
  });

  it('builds DELETE', () => {
    const req = TestRequest.delete('/users/1').build();
    expect(req.method).toBe('DELETE');
  });
});

describe('@carpentry/testing: assertThrows', () => {
  it('passes when function throws', async () => {
    await assertThrows(() => { throw new Error('boom'); });
  });

  it('fails when function does not throw', async () => {
    await expect(assertThrows(() => 'no throw')).rejects.toThrow('Expected function to throw');
  });

  it('checks error message', async () => {
    await assertThrows(() => { throw new Error('specific'); }, 'specific');
  });

  it('checks error type', async () => {
    await assertThrows(() => { throw new TypeError('bad type'); }, undefined, TypeError);
  });
});

describe('@carpentry/testing: FakeClock', () => {
  it('starts at given time', () => {
    const clock = new FakeClock(1000);
    expect(clock.now()).toBe(1000);
  });

  it('advance() moves time forward', () => {
    const clock = new FakeClock(0);
    clock.advance(500);
    expect(clock.now()).toBe(500);
  });

  it('toDate() returns Date object', () => {
    const clock = new FakeClock(1704067200000); // 2024-01-01
    expect(clock.toDate()).toBeInstanceOf(Date);
  });
});
