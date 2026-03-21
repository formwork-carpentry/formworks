/**
 * @module @formwork/validation
 * @description Tests for FormRequest (Sprint 12 spec: FormRequest class)
 */

import { describe, it, expect } from 'vitest';
import { FormRequest } from '../src/FormRequest.js';
import type { ValidationRules } from '@formwork/core/contracts';

class StoreUserRequest extends FormRequest {
  rules(): ValidationRules {
    return {
      name: 'required|string|min:2',
      email: 'required|email',
    };
  }
}

class AdminOnlyRequest extends FormRequest {
  rules(): ValidationRules {
    return { title: 'required|string' };
  }

  authorize(): boolean {
    return this.user?.role === 'admin';
  }
}

class CustomMessagesRequest extends FormRequest {
  rules(): ValidationRules {
    return { name: 'required' };
  }

  messages(): Record<string, string> {
    return { 'name.required': 'Please enter your name.' };
  }
}

describe('FormRequest', () => {
  describe('basic validation', () => {
    it('passes with valid data', () => {
      const req = new StoreUserRequest();
      req.setData({ name: 'John', email: 'john@example.com' });
      const result = req.validate();
      expect(result.passes).toBe(true);
      expect(result.authorized).toBe(true);
      expect(result.validated).toHaveProperty('name', 'John');
      expect(result.validated).toHaveProperty('email', 'john@example.com');
    });

    it('fails with missing required fields', () => {
      const req = new StoreUserRequest();
      req.setData({});
      const result = req.validate();
      expect(result.passes).toBe(false);
      expect(result.errors).toHaveProperty('name');
      expect(result.errors).toHaveProperty('email');
    });

    it('fails with invalid email', () => {
      const req = new StoreUserRequest();
      req.setData({ name: 'John', email: 'not-an-email' });
      const result = req.validate();
      expect(result.passes).toBe(false);
      expect(result.errors).toHaveProperty('email');
    });

    it('fails with name too short', () => {
      const req = new StoreUserRequest();
      req.setData({ name: 'J', email: 'john@example.com' });
      const result = req.validate();
      expect(result.passes).toBe(false);
      expect(result.errors).toHaveProperty('name');
    });
  });

  describe('authorization', () => {
    it('passes authorization for admin', () => {
      const req = new AdminOnlyRequest();
      req.setUser({ role: 'admin' });
      req.setData({ title: 'Admin Post' });
      const result = req.validate();
      expect(result.authorized).toBe(true);
      expect(result.passes).toBe(true);
    });

    it('fails authorization for non-admin', () => {
      const req = new AdminOnlyRequest();
      req.setUser({ role: 'user' });
      req.setData({ title: 'Attempt' });
      const result = req.validate();
      expect(result.authorized).toBe(false);
      expect(result.passes).toBe(false);
      expect(result.errors).toHaveProperty('_authorization');
    });

    it('fails authorization with no user', () => {
      const req = new AdminOnlyRequest();
      req.setData({ title: 'No User' });
      const result = req.validate();
      expect(result.authorized).toBe(false);
    });

    it('default authorize() returns true', () => {
      const req = new StoreUserRequest();
      req.setData({ name: 'John', email: 'john@example.com' });
      const result = req.validate();
      expect(result.authorized).toBe(true);
    });
  });

  describe('validated() method', () => {
    it('returns validated data on success', () => {
      const req = new StoreUserRequest();
      req.setData({ name: 'John', email: 'john@example.com', extra: 'ignored' });
      const data = req.validated();
      expect(data).toHaveProperty('name', 'John');
      expect(data).toHaveProperty('email', 'john@example.com');
    });

    it('throws on validation failure', () => {
      const req = new StoreUserRequest();
      req.setData({});
      expect(() => req.validated()).toThrow('Validation failed.');
    });

    it('throws on authorization failure', () => {
      const req = new AdminOnlyRequest();
      req.setUser({ role: 'user' });
      req.setData({ title: 'Blocked' });
      expect(() => req.validated()).toThrow('unauthorized');
    });

    it('throws with error code and status', () => {
      const req = new StoreUserRequest();
      req.setData({});
      try {
        req.validated();
      } catch (err: unknown) {
        const e = err as { code: string; status: number; errors: Record<string, string[]> };
        expect(e.code).toBe('VALIDATION_ERROR');
        expect(e.status).toBe(422);
        expect(e.errors).toHaveProperty('name');
        return;
      }
      expect.unreachable('Should have thrown');
    });
  });

  describe('custom messages', () => {
    it('uses custom message for required rule', () => {
      const req = new CustomMessagesRequest();
      req.setData({});
      const result = req.validate();
      expect(result.passes).toBe(false);
      expect(result.errors['name']?.[0]).toBe('Please enter your name.');
    });
  });

  describe('fluent setters', () => {
    it('setData returns this for chaining', () => {
      const req = new StoreUserRequest();
      const result = req.setData({ name: 'X' }).setUser({ id: 1 });
      expect(result).toBe(req);
    });
  });
});
