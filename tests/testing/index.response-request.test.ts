import { describe, expect, it } from 'vitest';

import {
  TestRequest,
  TestResponse,
  assertThrows,
} from '../../src/testing/index.js';

describe('testing/index response/request utilities', () => {
  it('asserts response status, headers, and payload shape', () => {
    const response = new TestResponse(
      422,
      { ok: false, errors: { email: ['required'] } },
      { 'content-type': 'application/json' },
    );

    expect(() => response.assertStatus(422)).not.toThrow();
    expect(() => response.assertJsonHas('errors')).not.toThrow();
    expect(() => response.assertJsonContains({ ok: false })).not.toThrow();
    expect(() => response.assertHeader('content-type', 'application/json')).not.toThrow();
    expect(() => response.assertValidationError('email')).not.toThrow();
    expect(() => response.assertUnauthorized()).toThrow('Expected status 401');
  });

  it('creates TestResponse from response-like object', () => {
    const wrapped = TestResponse.from({
      statusCode: 200,
      getBody: () => ({ ok: true, list: [1, 2] }),
      getHeaders: () => ({ 'x-request-id': 'r1' }),
    });

    expect(wrapped.getStatus()).toBe(200);
    expect(wrapped.getBody()).toEqual({ ok: true, list: [1, 2] });
    expect(wrapped.getHeaders()).toEqual({ 'x-request-id': 'r1' });
    expect(() => wrapped.assertOk().assertJsonEquals({ ok: true, list: [1, 2] })).not.toThrow();
  });

  it('builds requests for multiple methods and request bodies', async () => {
    const getReq = TestRequest.get('/health').withHeader('x-test', '1').build();
    const postReq = TestRequest.post('/users').withJson({ name: 'A' }).build();
    const putReq = TestRequest.put('/users/1').withBody('raw', 'text/plain').build();
    const patchReq = TestRequest.patch('/users/1').withToken('abc').build();
    const deleteReq = TestRequest.delete('/users/1').build();

    expect(getReq.method).toBe('GET');
    expect(getReq.headers.get('x-test')).toBe('1');

    expect(postReq.method).toBe('POST');
    expect(postReq.headers.get('content-type')).toContain('application/json');
    expect(await postReq.text()).toBe('{"name":"A"}');

    expect(putReq.method).toBe('PUT');
    expect(putReq.headers.get('content-type')).toContain('text/plain');
    expect(await putReq.text()).toBe('raw');

    expect(patchReq.method).toBe('PATCH');
    expect(patchReq.headers.get('authorization')).toBe('Bearer abc');

    expect(deleteReq.method).toBe('DELETE');
  });

  it('assertThrows validates throw presence, message, regex and type', async () => {
    class CustomError extends Error {}

    await expect(assertThrows(() => {
      throw new CustomError('kaboom happened');
    }, 'kaboom', CustomError)).resolves.toBeUndefined();

    await expect(assertThrows(async () => {
      throw new Error('timed out');
    }, /timed\s+out/)).resolves.toBeUndefined();

    await expect(assertThrows(() => 'ok')).rejects.toThrow('Expected function to throw');
  });
});
