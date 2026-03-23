/**
 * @module @carpentry/validation
 * @description Tests for Validator (CARP-031) — rules, nested fields, custom rules, messages
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Validator, makeRule } from '../src/validator/Validator.js';

describe('CARP-031: Validator', () => {
  let v: Validator;

  beforeEach(() => {
    v = new Validator();
  });

  describe('required', () => {
    it('fails on missing field', () => {
      const r = v.validate({}, { name: 'required' });
      expect(r.passes).toBe(false);
      expect(r.errors['name']).toBeDefined();
    });

    it('fails on empty string', () => {
      const r = v.validate({ name: '' }, { name: 'required' });
      expect(r.passes).toBe(false);
    });

    it('fails on null', () => {
      const r = v.validate({ name: null }, { name: 'required' });
      expect(r.passes).toBe(false);
    });

    it('passes on valid value', () => {
      const r = v.validate({ name: 'Alice' }, { name: 'required' });
      expect(r.passes).toBe(true);
    });

    it('passes on zero (valid value)', () => {
      const r = v.validate({ count: 0 }, { count: 'required' });
      expect(r.passes).toBe(true);
    });
  });

  describe('string / number / boolean', () => {
    it('string passes on string', () => {
      expect(v.validate({ x: 'hi' }, { x: 'string' }).passes).toBe(true);
    });

    it('string fails on number', () => {
      expect(v.validate({ x: 42 }, { x: 'string' }).passes).toBe(false);
    });

    it('number passes on number', () => {
      expect(v.validate({ x: 42 }, { x: 'number' }).passes).toBe(true);
    });

    it('number fails on string', () => {
      expect(v.validate({ x: '42' }, { x: 'number' }).passes).toBe(false);
    });

    it('boolean passes on boolean', () => {
      expect(v.validate({ x: true }, { x: 'boolean' }).passes).toBe(true);
    });
  });

  describe('email', () => {
    it('passes on valid email', () => {
      expect(v.validate({ e: 'a@b.com' }, { e: 'email' }).passes).toBe(true);
    });

    it('fails on invalid email', () => {
      expect(v.validate({ e: 'not-email' }, { e: 'email' }).passes).toBe(false);
    });

    it('passes on empty (not required)', () => {
      expect(v.validate({ e: '' }, { e: 'email' }).passes).toBe(true);
    });
  });

  describe('url', () => {
    it('passes on valid URL', () => {
      expect(v.validate({ u: 'https://example.com' }, { u: 'url' }).passes).toBe(true);
    });

    it('fails on invalid URL', () => {
      expect(v.validate({ u: 'not a url' }, { u: 'url' }).passes).toBe(false);
    });
  });

  describe('uuid', () => {
    it('passes on valid UUID', () => {
      expect(v.validate({ id: '550e8400-e29b-41d4-a716-446655440000' }, { id: 'uuid' }).passes).toBe(true);
    });

    it('fails on invalid UUID', () => {
      expect(v.validate({ id: 'not-a-uuid' }, { id: 'uuid' }).passes).toBe(false);
    });
  });

  describe('min / max / between', () => {
    it('min on string length', () => {
      expect(v.validate({ s: 'ab' }, { s: 'min:3' }).passes).toBe(false);
      expect(v.validate({ s: 'abc' }, { s: 'min:3' }).passes).toBe(true);
    });

    it('min on number value', () => {
      expect(v.validate({ n: 5 }, { n: 'min:10' }).passes).toBe(false);
      expect(v.validate({ n: 15 }, { n: 'min:10' }).passes).toBe(true);
    });

    it('max on string length', () => {
      expect(v.validate({ s: 'abcdef' }, { s: 'max:5' }).passes).toBe(false);
      expect(v.validate({ s: 'abc' }, { s: 'max:5' }).passes).toBe(true);
    });

    it('between on number', () => {
      expect(v.validate({ n: 5 }, { n: 'between:1,10' }).passes).toBe(true);
      expect(v.validate({ n: 15 }, { n: 'between:1,10' }).passes).toBe(false);
    });

    it('min on array length', () => {
      expect(v.validate({ a: [1] }, { a: 'min:2' }).passes).toBe(false);
      expect(v.validate({ a: [1, 2, 3] }, { a: 'min:2' }).passes).toBe(true);
    });
  });

  describe('in', () => {
    it('passes when value is in list', () => {
      expect(v.validate({ s: 'active' }, { s: 'in:active,inactive,banned' }).passes).toBe(true);
    });

    it('fails when value not in list', () => {
      expect(v.validate({ s: 'unknown' }, { s: 'in:active,inactive' }).passes).toBe(false);
    });
  });

  describe('confirmed', () => {
    it('passes when confirmation matches', () => {
      const r = v.validate(
        { password: 'secret', password_confirmation: 'secret' },
        { password: 'required|confirmed' },
      );
      expect(r.passes).toBe(true);
    });

    it('fails when confirmation does not match', () => {
      const r = v.validate(
        { password: 'secret', password_confirmation: 'different' },
        { password: 'required|confirmed' },
      );
      expect(r.passes).toBe(false);
      expect(r.errors['password']).toBeDefined();
    });
  });

  describe('nullable', () => {
    it('nullable allows null and skips other rules', () => {
      const r = v.validate({ bio: null }, { bio: 'nullable|string|min:5' });
      expect(r.passes).toBe(true);
    });

    it('nullable allows undefined', () => {
      const r = v.validate({}, { bio: 'nullable|string' });
      expect(r.passes).toBe(true);
    });

    it('non-null value still validated', () => {
      const r = v.validate({ bio: 42 }, { bio: 'nullable|string' });
      expect(r.passes).toBe(false);
    });
  });

  describe('array', () => {
    it('passes on array', () => {
      expect(v.validate({ t: ['a', 'b'] }, { t: 'array' }).passes).toBe(true);
    });

    it('fails on non-array', () => {
      expect(v.validate({ t: 'not array' }, { t: 'array' }).passes).toBe(false);
    });
  });

  describe('regex', () => {
    it('passes matching regex', () => {
      expect(v.validate({ c: 'ABC123' }, { c: 'regex:^[A-Z0-9]+$' }).passes).toBe(true);
    });

    it('fails non-matching regex', () => {
      expect(v.validate({ c: 'abc!!!' }, { c: 'regex:^[A-Z0-9]+$' }).passes).toBe(false);
    });
  });

  describe('date', () => {
    it('passes valid date', () => {
      expect(v.validate({ d: '2024-01-15' }, { d: 'date' }).passes).toBe(true);
    });

    it('fails invalid date', () => {
      expect(v.validate({ d: 'not-a-date' }, { d: 'date' }).passes).toBe(false);
    });
  });

  describe('pipe-separated rule syntax', () => {
    it('validates multiple rules per field', () => {
      const r = v.validate({ name: 'Al' }, { name: 'required|string|min:3' });
      expect(r.passes).toBe(false);
      expect(r.errors['name']).toHaveLength(1); // min:3 fails
    });

    it('collects multiple errors per field', () => {
      const r = v.validate({ age: 'not a number' }, { age: 'required|number|min:0' });
      expect(r.passes).toBe(false);
      expect(r.errors['age'].length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('multiple fields', () => {
    it('validates all fields', () => {
      const r = v.validate(
        { name: '', email: 'bad' },
        { name: 'required|string', email: 'required|email' },
      );
      expect(r.passes).toBe(false);
      expect(r.errors['name']).toBeDefined();
      expect(r.errors['email']).toBeDefined();
    });

    it('returns validated data on success', () => {
      const r = v.validate(
        { name: 'Alice', email: 'a@b.com', extra: 'ignored' },
        { name: 'required|string', email: 'required|email' },
      );
      expect(r.passes).toBe(true);
      expect(r.validated).toEqual({ name: 'Alice', email: 'a@b.com' });
      expect(r.validated).not.toHaveProperty('extra');
    });
  });

  describe('nested dot-notation fields', () => {
    it('validates nested fields', () => {
      const r = v.validate(
        { address: { city: 'NYC', zip: '' } },
        { 'address.city': 'required|string', 'address.zip': 'required' },
      );
      expect(r.passes).toBe(false);
      expect(r.errors['address.zip']).toBeDefined();
    });

    it('passes on valid nested fields', () => {
      const r = v.validate(
        { address: { city: 'NYC', zip: '10001' } },
        { 'address.city': 'required', 'address.zip': 'required' },
      );
      expect(r.passes).toBe(true);
    });
  });

  describe('custom error messages', () => {
    it('uses field-specific custom message', () => {
      const r = v.validate(
        { name: '' },
        { name: 'required' },
        { name: 'Please enter your name.' },
      );
      expect(r.errors['name'][0]).toBe('Please enter your name.');
    });

    it('uses field.rule-specific custom message', () => {
      const r = v.validate(
        { name: 'Al' },
        { name: 'required|min:3' },
        { 'name.min': 'Name too short!' },
      );
      expect(r.errors['name'][0]).toBe('Name too short!');
    });
  });

  describe('custom rules', () => {
    it('addRule() registers a custom rule', () => {
      v.addRule(makeRule(
        'even',
        (_attr, value) => typeof value === 'number' && value % 2 === 0,
        (attr) => `The ${attr} must be an even number.`,
      ));

      expect(v.validate({ n: 4 }, { n: 'even' }).passes).toBe(true);
      expect(v.validate({ n: 3 }, { n: 'even' }).passes).toBe(false);
    });

    it('custom rules compose with built-in rules', () => {
      v.addRule(makeRule('positive', (_a, val) => typeof val === 'number' && val > 0, (a) => `${a} must be positive.`));

      const r = v.validate({ score: -5 }, { score: 'required|number|positive' });
      expect(r.passes).toBe(false);
      expect(r.errors['score']).toBeDefined();
    });

    it('throws on unknown rule', () => {
      expect(() => v.validate({ x: 1 }, { x: 'nonexistent_rule' })).toThrow('not defined');
    });
  });

  describe('IValidationRule array syntax', () => {
    it('accepts rule objects directly', () => {
      const customRule = makeRule('always_fail', () => false, (attr) => `${attr} always fails.`);
      const r = v.validate({ x: 'hello' }, { x: [customRule] });
      expect(r.passes).toBe(false);
      expect(r.errors['x'][0]).toBe('x always fails.');
    });
  });
});
