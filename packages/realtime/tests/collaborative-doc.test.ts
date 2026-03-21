/**
 * @module @formwork/realtime
 * @description Tests for CollaborativeDoc (CRDT-based collaborative editing)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CollaborativeDoc } from '../src/CollaborativeDoc.js';
import type { DocOperation } from '../src/CollaborativeDoc.js';

describe('@formwork/realtime: CollaborativeDoc', () => {
  let doc: CollaborativeDoc;

  beforeEach(() => {
    doc = new CollaborativeDoc('test-doc');
  });

  describe('basic operations', () => {
    it('starts with empty text', () => {
      expect(doc.getText()).toBe('');
      expect(doc.getVersion()).toBe(0);
      expect(doc.getLength()).toBe(0);
    });

    it('starts with initial text', () => {
      const d = new CollaborativeDoc('d', 'Hello');
      expect(d.getText()).toBe('Hello');
    });

    it('inserts text at position', () => {
      doc.insert(0, 'Hello', 'user-a');
      expect(doc.getText()).toBe('Hello');
      expect(doc.getVersion()).toBe(1);
    });

    it('inserts at middle', () => {
      doc.insert(0, 'Hllo', 'user-a');
      doc.insert(1, 'e', 'user-a');
      expect(doc.getText()).toBe('Hello');
    });

    it('inserts at end', () => {
      doc.insert(0, 'Hello', 'user-a');
      doc.insert(5, ' World', 'user-a');
      expect(doc.getText()).toBe('Hello World');
    });

    it('deletes text', () => {
      doc.insert(0, 'Hello World', 'user-a');
      doc.delete(5, 6, 'user-a');
      expect(doc.getText()).toBe('Hello');
    });

    it('clamps insert position to valid range', () => {
      doc.insert(999, 'X', 'user-a');
      expect(doc.getText()).toBe('X');
    });

    it('clamps delete to valid range', () => {
      doc.insert(0, 'Hi', 'a');
      doc.delete(1, 999, 'a'); // delete from pos 1, way past end
      expect(doc.getText()).toBe('H');
    });
  });

  describe('operation idempotency', () => {
    it('applying the same operation twice has no effect', () => {
      const op = doc.insert(0, 'Hello', 'user-a');
      const applied = doc.applyOperation(op);
      expect(applied).toBe(false); // Already applied
      expect(doc.getText()).toBe('Hello'); // Not doubled
    });
  });

  describe('concurrent editing', () => {
    it('two users insert at different positions', () => {
      doc.insert(0, 'AB', 'user-a');
      doc.insert(1, 'X', 'user-b');
      expect(doc.getText()).toBe('AXB');
    });

    it('remote operations are applied and deduplicated', () => {
      // Test that operations from one replica can be applied to another
      // and that duplicate application is a no-op
      const doc1 = new CollaborativeDoc('d', 'Hello');
      const doc2 = new CollaborativeDoc('d', 'Hello');

      // User A appends to doc1
      const op1 = doc1.insert(5, ' World', 'user-a');
      expect(doc1.getText()).toBe('Hello World');

      // Apply op1 to doc2 — should produce same result
      const applied = doc2.applyOperation(op1);
      expect(applied).toBe(true);
      expect(doc2.getText()).toBe('Hello World');

      // Applying again should be a no-op (idempotent)
      const duplicate = doc2.applyOperation(op1);
      expect(duplicate).toBe(false);
      expect(doc2.getText()).toBe('Hello World');
    });
  });

  describe('history', () => {
    it('records operation history', () => {
      doc.insert(0, 'A', 'user-a');
      doc.insert(1, 'B', 'user-b');
      doc.delete(0, 1, 'user-a');

      expect(doc.getHistory()).toHaveLength(3);
      expect(doc.getHistory()[0].type).toBe('insert');
      expect(doc.getHistory()[2].type).toBe('delete');
    });

    it('getOperationsSince returns ops after a version', () => {
      doc.insert(0, 'A', 'a');
      doc.insert(1, 'B', 'b');
      doc.insert(2, 'C', 'c');

      const ops = doc.getOperationsSince(1);
      expect(ops.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('cursors', () => {
    it('tracks user cursors', () => {
      doc.updateCursor({ userId: 'user-a', position: 5, name: 'Alice', color: '#ff0000', lastUpdated: Date.now() });
      doc.updateCursor({ userId: 'user-b', position: 10, name: 'Bob', color: '#0000ff', lastUpdated: Date.now() });

      const cursors = doc.getCursors();
      expect(cursors).toHaveLength(2);
      expect(cursors.find((c) => c.userId === 'user-a')?.position).toBe(5);
    });

    it('updates cursor position', () => {
      doc.updateCursor({ userId: 'a', position: 0, lastUpdated: Date.now() });
      doc.updateCursor({ userId: 'a', position: 10, lastUpdated: Date.now() });
      expect(doc.getCursors().find((c) => c.userId === 'a')?.position).toBe(10);
    });

    it('removes cursor on disconnect', () => {
      doc.updateCursor({ userId: 'a', position: 0, lastUpdated: Date.now() });
      doc.removeCursor('a');
      expect(doc.getCursors()).toHaveLength(0);
    });

    it('adjusts cursors after insert', () => {
      doc.insert(0, 'Hello', 'a');
      doc.updateCursor({ userId: 'b', position: 3, lastUpdated: Date.now() });

      // Insert before cursor position → cursor should shift right
      doc.insert(0, 'XX', 'a');
      expect(doc.getCursors().find((c) => c.userId === 'b')?.position).toBe(5); // 3 + 2
    });
  });

  describe('event listeners', () => {
    it('fires onChange for every operation', () => {
      const ops: DocOperation[] = [];
      doc.onChange((op) => ops.push(op));

      doc.insert(0, 'A', 'a');
      doc.insert(1, 'B', 'b');

      expect(ops).toHaveLength(2);
      expect(ops[0].type).toBe('insert');
    });

    it('onChange returns unsubscribe function', () => {
      const ops: DocOperation[] = [];
      const unsub = doc.onChange((op) => ops.push(op));

      doc.insert(0, 'A', 'a');
      unsub();
      doc.insert(1, 'B', 'b');

      expect(ops).toHaveLength(1); // Only first op
    });

    it('fires onCursorChange', () => {
      const cursors: unknown[] = [];
      doc.onCursorChange((c) => cursors.push(c));

      doc.updateCursor({ userId: 'a', position: 5, lastUpdated: Date.now() });
      expect(cursors).toHaveLength(1);
    });
  });

  describe('snapshot', () => {
    it('returns current state', () => {
      doc.insert(0, 'Hello', 'a');
      doc.insert(5, ' World', 'b');

      const snap = doc.snapshot();
      expect(snap.text).toBe('Hello World');
      expect(snap.version).toBe(2);
      expect(snap.operationCount).toBe(2);
    });
  });
});
