import { describe, it, expect } from 'vitest';
import { useForm } from '../../src/ui/FormHelper.js';

describe('ui/useForm state', () => {
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
});
