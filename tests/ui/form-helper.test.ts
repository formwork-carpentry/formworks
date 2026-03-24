import { describe, it, expect } from 'vitest';
import { useForm } from '../../src/ui/FormHelper.js';

function mockFetch(status: number, body: Record<string, unknown>): typeof fetch {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
}

describe('ui/useForm', () => {
  it('initializes with data', () => {
    const form = useForm({ name: '', email: '' });
    expect(form.data.name).toBe('');
    expect(form.processing).toBe(false);
    expect(form.hasErrors).toBe(false);
  });

  it('tracks dirty state', () => {
    const form = useForm({ name: 'Alice' });
    expect(form.isDirty).toBe(false);
    form.data.name = 'Bob';
    expect(form.isDirty).toBe(true);
  });

  it('submits POST and handles success', async () => {
    const form = useForm({ title: 'Hello' });
    let successData: unknown;

    const result = await form.post('/api/posts', {
      fetchFn: mockFetch(201, { data: { id: 1 } }),
      onSuccess: (d) => {
        successData = d;
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(successData).toEqual({ data: { id: 1 } });
    expect(form.recentlySuccessful).toBe(true);
  });

  it('handles 422 validation errors', async () => {
    const form = useForm({ email: 'bad' });
    let errorsCaptured: Record<string, string[]> = {};

    const result = await form.post('/api/register', {
      fetchFn: mockFetch(422, { errors: { email: ['Invalid email format'] } }),
      onError: (e) => {
        errorsCaptured = e;
      },
    });

    expect(result.ok).toBe(false);
    expect(form.hasErrors).toBe(true);
    expect(form.errors['email']).toEqual(['Invalid email format']);
    expect(errorsCaptured['email']).toEqual(['Invalid email format']);
  });

  it('tracks processing state', async () => {
    const form = useForm({ x: 1 });
    const states: boolean[] = [];
    form.onChange((f) => states.push(f.processing));

    await form.post('/api/test', { fetchFn: mockFetch(200, {}) });

    expect(states).toContain(true);
    expect(form.processing).toBe(false);
  });

  it('resets to initial values', () => {
    const form = useForm({ name: 'Alice', email: 'alice@test.com' });
    form.data.name = 'Bob';
    form.setError('name', 'Too short');

    form.reset();

    expect(form.data.name).toBe('Alice');
    expect(form.hasErrors).toBe(false);
    expect(form.isDirty).toBe(false);
  });

  it('clears specific field errors', () => {
    const form = useForm({ a: '', b: '' });
    form.setError('a', 'Required');
    form.setError('b', 'Required');
    form.clearError('a');
    expect(form.errors['a']).toBeUndefined();
    expect(form.errors['b']).toEqual(['Required']);
  });

  it('transforms data before submission', async () => {
    const form = useForm({ name: 'alice', age: '25' });
    let sentBody: unknown;

    const fakeFetch: typeof fetch = async (_url, init) => {
      sentBody = JSON.parse(init?.body as string);
      return new Response('{}', { status: 200 });
    };

    form.transform((data) => ({ ...data, name: data.name.toUpperCase(), age: Number(data.age) }));
    await form.post('/api/users', { fetchFn: fakeFetch });

    expect(sentBody).toEqual({ name: 'ALICE', age: 25 });
  });

  it('supports PUT, PATCH, DELETE', async () => {
    const form = useForm({ id: 1 });
    const methods: string[] = [];
    const fakeFetch: typeof fetch = async (_url, init) => {
      methods.push(init?.method ?? 'GET');
      return new Response('{}', { status: 200 });
    };

    await form.put('/api/x', { fetchFn: fakeFetch });
    await form.patch('/api/x', { fetchFn: fakeFetch });
    await form.delete('/api/x', { fetchFn: fakeFetch });

    expect(methods).toEqual(['PUT', 'PATCH', 'DELETE']);
  });
});
