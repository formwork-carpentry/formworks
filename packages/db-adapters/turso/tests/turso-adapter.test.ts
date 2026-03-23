import { describe, it, expect } from 'vitest';
import { TursoDatabaseAdapter } from '../src/index.js';

describe('@carpentry/db-turso: TursoDatabaseAdapter', () => {
  it('executes basic insert/select/update/delete statements', async () => {
    const db = new TursoDatabaseAdapter({ url: 'libsql://test-db' });

    await db.execute('INSERT INTO users (id, name, active) VALUES (?, ?, ?)', ['1', 'Alice', true]);
    await db.execute('INSERT INTO users (id, name, active) VALUES (?, ?, ?)', ['2', 'Bob', false]);

    const all = await db.query('SELECT * FROM users');
    expect(all).toHaveLength(2);

    const one = await db.query('SELECT * FROM users WHERE id = ?', ['1']);
    expect(one).toEqual([{ id: '1', name: 'Alice', active: true }]);

    const updated = await db.execute('UPDATE users SET name = ?, active = ? WHERE id = ?', ['Alicia', true, '1']);
    expect(updated.rowsAffected).toBe(1);

    const afterUpdate = await db.query('SELECT * FROM users WHERE id = ?', ['1']);
    expect(afterUpdate).toEqual([{ id: '1', name: 'Alicia', active: true }]);

    const deleted = await db.execute('DELETE FROM users WHERE id = ?', ['2']);
    expect(deleted.rowsAffected).toBe(1);

    const remaining = await db.query('SELECT * FROM users');
    expect(remaining).toEqual([{ id: '1', name: 'Alicia', active: true }]);
  });

  it('throws after close', async () => {
    const db = new TursoDatabaseAdapter({ url: 'libsql://test-db-close' });
    await db.close();

    await expect(db.query('SELECT * FROM users')).rejects.toThrow('closed');
    await expect(db.execute('INSERT INTO users (id) VALUES (?)', ['1'])).rejects.toThrow('closed');
  });
});
