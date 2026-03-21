/**
 * @module @formwork/orm
 * @description Tests for N+1 Query Detector (Sprint 17/19 spec requirement)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NplusOneDetector } from '../src/detection/NplusOneDetector.js';

describe('NplusOneDetector', () => {
  let detector: NplusOneDetector;

  beforeEach(() => {
    detector = new NplusOneDetector({ threshold: 3 });
  });

  describe('query recording', () => {
    it('records queries', () => {
      detector.recordQuery('SELECT * FROM users WHERE id = 1');
      detector.recordQuery('SELECT * FROM posts');
      expect(detector.getQueryCount()).toBe(2);
    });

    it('returns recorded queries', () => {
      detector.recordQuery('SELECT * FROM users', []);
      const queries = detector.getQueries();
      expect(queries).toHaveLength(1);
      expect(queries[0].sql).toBe('SELECT * FROM users');
    });
  });

  describe('N+1 detection', () => {
    it('detects repeated identical query patterns', () => {
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 1');
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 2');
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 3');

      const warnings = detector.getWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0].queryPattern).toContain('posts');
      expect(warnings[0].count).toBe(3);
    });

    it('does not warn below threshold', () => {
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 1');
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 2');

      expect(detector.getWarnings()).toHaveLength(0);
    });

    it('normalizes string literals in pattern matching', () => {
      detector.recordQuery("SELECT * FROM users WHERE name = 'Alice'");
      detector.recordQuery("SELECT * FROM users WHERE name = 'Bob'");
      detector.recordQuery("SELECT * FROM users WHERE name = 'Charlie'");

      const warnings = detector.getWarnings();
      expect(warnings).toHaveLength(1);
    });

    it('normalizes numeric literals in pattern matching', () => {
      detector.recordQuery('SELECT * FROM comments WHERE post_id = 100');
      detector.recordQuery('SELECT * FROM comments WHERE post_id = 200');
      detector.recordQuery('SELECT * FROM comments WHERE post_id = 300');

      const warnings = detector.getWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0].queryPattern).toContain('comments');
    });

    it('distinguishes different query patterns', () => {
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 1');
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 2');
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 3');
      detector.recordQuery('SELECT * FROM comments WHERE post_id = 1');
      detector.recordQuery('SELECT * FROM comments WHERE post_id = 2');

      const warnings = detector.getWarnings();
      expect(warnings).toHaveLength(1); // Only posts hit threshold
    });

    it('provides suggestion with table name', () => {
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 1');
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 2');
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 3');

      const warning = detector.getWarnings()[0];
      expect(warning.suggestion).toContain('eager loading');
      expect(warning.suggestion).toContain('posts');
    });

    it('tracks occurrences with original SQL', () => {
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 1');
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 2');
      detector.recordQuery('SELECT * FROM posts WHERE user_id = 3');

      const warning = detector.getWarnings()[0];
      expect(warning.occurrences).toHaveLength(3);
      expect(warning.occurrences[0].sql).toContain('user_id = 1');
      expect(warning.occurrences[2].sql).toContain('user_id = 3');
    });
  });

  describe('analyze()', () => {
    it('returns all warnings at end of request', () => {
      for (let i = 1; i <= 5; i++) {
        detector.recordQuery(`SELECT * FROM tags WHERE post_id = ${i}`);
      }

      const warnings = detector.analyze();
      expect(warnings).toHaveLength(1);
      expect(warnings[0].count).toBe(5);
    });

    it('does not duplicate warnings', () => {
      for (let i = 1; i <= 5; i++) {
        detector.recordQuery(`SELECT * FROM posts WHERE user_id = ${i}`);
      }

      detector.analyze();
      detector.analyze();
      expect(detector.getWarnings()).toHaveLength(1);
    });
  });

  describe('configuration', () => {
    it('respects custom threshold', () => {
      const strict = new NplusOneDetector({ threshold: 2 });
      strict.recordQuery('SELECT * FROM posts WHERE user_id = 1');
      strict.recordQuery('SELECT * FROM posts WHERE user_id = 2');
      expect(strict.getWarnings()).toHaveLength(1);
    });

    it('calls custom onWarning handler', () => {
      const warnings: string[] = [];
      const custom = new NplusOneDetector({
        threshold: 2,
        onWarning: (w) => warnings.push(w.queryPattern),
      });
      custom.recordQuery('SELECT * FROM posts WHERE id = 1');
      custom.recordQuery('SELECT * FROM posts WHERE id = 2');
      expect(warnings).toHaveLength(1);
    });

    it('throws when throwOnDetection is true', () => {
      const strict = new NplusOneDetector({ threshold: 2, throwOnDetection: true });
      strict.recordQuery('SELECT * FROM posts WHERE id = 1');
      expect(() => {
        strict.recordQuery('SELECT * FROM posts WHERE id = 2');
      }).toThrow('N+1 query detected');
    });

    it('does nothing when disabled', () => {
      const disabled = new NplusOneDetector({ enabled: false });
      for (let i = 0; i < 100; i++) {
        disabled.recordQuery(`SELECT * FROM posts WHERE id = ${i}`);
      }
      expect(disabled.getQueryCount()).toBe(0);
      expect(disabled.getWarnings()).toHaveLength(0);
    });
  });

  describe('reset()', () => {
    it('clears all state', () => {
      detector.recordQuery('SELECT * FROM posts WHERE id = 1');
      detector.recordQuery('SELECT * FROM posts WHERE id = 2');
      detector.recordQuery('SELECT * FROM posts WHERE id = 3');

      expect(detector.getWarnings()).toHaveLength(1);
      detector.reset();

      expect(detector.getQueryCount()).toBe(0);
      expect(detector.getWarnings()).toHaveLength(0);
    });
  });

  describe('params tracking', () => {
    it('records params with queries', () => {
      detector.recordQuery('SELECT * FROM users WHERE id = ?', [42]);
      const queries = detector.getQueries();
      expect(queries[0].params).toEqual([42]);
    });
  });
});
