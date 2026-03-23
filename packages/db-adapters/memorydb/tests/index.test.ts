import { describe, it, expect, beforeEach } from 'vitest';
import { SQLiteMemoryAdapter } from '../src/index.js';

describe('@carpentry/db-adapters: SQLiteMemoryAdapter', () => {
  let db: SQLiteMemoryAdapter;

  beforeEach(() => { db = new SQLiteMemoryAdapter(); });

  it('CREATE TABLE + INSERT + SELECT', async () => {
    await db.execute({ sql: 'CREATE TABLE users (id, name, email)', bindings: [], type: 'schema' });
    await db.execute({ sql: 'INSERT INTO users (name, email) VALUES (?, ?)', bindings: ['Alice', 'a@b.com'], type: 'insert' });
    await db.execute({ sql: 'INSERT INTO users (name, email) VALUES (?, ?)', bindings: ['Bob', 'b@b.com'], type: 'insert' });

    const result = await db.execute({ sql: 'SELECT * FROM users', bindings: [], type: 'select' });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ id: 1, name: 'Alice', email: 'a@b.com' });
    expect(result.rows[1]).toEqual({ id: 2, name: 'Bob', email: 'b@b.com' });
  });

  it('auto-increments IDs', async () => {
    await db.execute({ sql: 'CREATE TABLE posts (id, title)', bindings: [], type: 'schema' });
    const r1 = await db.execute({ sql: 'INSERT INTO posts (title) VALUES (?)', bindings: ['First'], type: 'insert' });
    const r2 = await db.execute({ sql: 'INSERT INTO posts (title) VALUES (?)', bindings: ['Second'], type: 'insert' });

    expect(r1.insertId).toBe(1);
    expect(r2.insertId).toBe(2);
  });

  it('SELECT with WHERE', async () => {
    await db.execute({ sql: 'CREATE TABLE users (id, name, role)', bindings: [], type: 'schema' });
    await db.execute({ sql: 'INSERT INTO users (name, role) VALUES (?, ?)', bindings: ['Alice', 'admin'], type: 'insert' });
    await db.execute({ sql: 'INSERT INTO users (name, role) VALUES (?, ?)', bindings: ['Bob', 'user'], type: 'insert' });

    const result = await db.execute({ sql: 'SELECT * FROM users WHERE role = ?', bindings: ['admin'], type: 'select' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(expect.objectContaining({ name: 'Alice' }));
  });

  it('SELECT with LIMIT', async () => {
    await db.execute({ sql: 'CREATE TABLE items (id, name)', bindings: [], type: 'schema' });
    for (let i = 1; i <= 10; i++) {
      await db.execute({ sql: 'INSERT INTO items (name) VALUES (?)', bindings: [`Item ${i}`], type: 'insert' });
    }

    const result = await db.execute({ sql: 'SELECT * FROM items LIMIT 3', bindings: [], type: 'select' });
    expect(result.rows).toHaveLength(3);
  });

  it('UPDATE with WHERE', async () => {
    await db.execute({ sql: 'CREATE TABLE users (id, name, active)', bindings: [], type: 'schema' });
    await db.execute({ sql: 'INSERT INTO users (name, active) VALUES (?, ?)', bindings: ['Alice', true], type: 'insert' });

    const result = await db.execute({ sql: 'UPDATE users SET active = ? WHERE id = ?', bindings: [false, 1], type: 'update' });
    expect(result.rowCount).toBe(1);

    const check = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', bindings: [1], type: 'select' });
    expect(check.rows[0]).toEqual(expect.objectContaining({ active: false }));
  });

  it('DELETE with WHERE', async () => {
    await db.execute({ sql: 'CREATE TABLE users (id, name)', bindings: [], type: 'schema' });
    await db.execute({ sql: 'INSERT INTO users (name) VALUES (?)', bindings: ['Alice'], type: 'insert' });
    await db.execute({ sql: 'INSERT INTO users (name) VALUES (?)', bindings: ['Bob'], type: 'insert' });

    const result = await db.execute({ sql: 'DELETE FROM users WHERE id = ?', bindings: [1], type: 'delete' });
    expect(result.rowCount).toBe(1);

    const remaining = await db.execute({ sql: 'SELECT * FROM users', bindings: [], type: 'select' });
    expect(remaining.rows).toHaveLength(1);
    expect(remaining.rows[0]).toEqual(expect.objectContaining({ name: 'Bob' }));
  });

  it('DELETE without WHERE deletes all rows (no bindings path)', async () => {
    await db.execute({ sql: 'CREATE TABLE users (id, name)', bindings: [], type: 'schema' });
    await db.execute({ sql: 'INSERT INTO users (name) VALUES (?)', bindings: ['Alice'], type: 'insert' });
    await db.execute({ sql: 'INSERT INTO users (name) VALUES (?)', bindings: ['Bob'], type: 'insert' });

    const result = await db.execute({ sql: 'DELETE FROM users', bindings: [], type: 'delete' });
    expect(result.rowCount).toBe(2);
    const remaining = await db.execute({ sql: 'SELECT * FROM users', bindings: [], type: 'select' });
    expect(remaining.rows).toHaveLength(0);
  });

  it('applyWheres fallback: WHERE clause present but no bindings', async () => {
    await db.execute({ sql: 'CREATE TABLE users (id, name)', bindings: [], type: 'schema' });
    await db.execute({ sql: 'INSERT INTO users (name) VALUES (?)', bindings: ['Alice'], type: 'insert' });
    await db.execute({ sql: 'INSERT INTO users (name) VALUES (?)', bindings: ['Bob'], type: 'insert' });

    const result = await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      bindings: [],
      type: 'delete',
    });

    // With this in-memory interpreter, missing bindings means "can't evaluate WHERE",
    // so it falls back to returning all rows and deletes them all.
    expect(result.rowCount).toBe(2);
    const remaining = await db.execute({ sql: 'SELECT * FROM users', bindings: [], type: 'select' });
    expect(remaining.rows).toHaveLength(0);
  });

  it('DROP TABLE', async () => {
    await db.execute({ sql: 'CREATE TABLE temp (id)', bindings: [], type: 'schema' });
    expect(db.getTableNames()).toContain('temp');

    await db.execute({ sql: 'DROP TABLE temp', bindings: [], type: 'schema' });
    expect(db.getTableNames()).not.toContain('temp');
  });

  it('CREATE TABLE IF NOT EXISTS', async () => {
    await db.execute({ sql: 'CREATE TABLE IF NOT EXISTS users (id)', bindings: [], type: 'schema' });
    await db.execute({ sql: 'CREATE TABLE IF NOT EXISTS users (id)', bindings: [], type: 'schema' }); // no error
    expect(db.getTableNames()).toContain('users');
  });

  it('batch INSERT (multiple value groups)', async () => {
    await db.execute({ sql: 'CREATE TABLE users (id, name)', bindings: [], type: 'schema' });
    await db.execute({
      sql: 'INSERT INTO users (name) VALUES (?), (?), (?)',
      bindings: ['A', 'B', 'C'],
      type: 'insert',
    });
    expect(db.getTable('users')).toHaveLength(3);
  });

  it('driverName()', () => {
    expect(db.driverName()).toBe('sqlite-memory');
  });

  it('query log', async () => {
    await db.execute({ sql: 'CREATE TABLE t (id)', bindings: [], type: 'schema' });
    await db.execute({ sql: 'SELECT * FROM t', bindings: [], type: 'select' });

    expect(db.getQueryLog()).toHaveLength(2);
    db.clearQueryLog();
    expect(db.getQueryLog()).toHaveLength(0);
  });

  it('raw(), transaction no-ops, and connect/disconnect', async () => {
    await db.execute({ sql: 'CREATE TABLE t (id, name)', bindings: [], type: 'schema' });
    await db.execute({ sql: 'INSERT INTO t (name) VALUES (?)', bindings: ['Alice'], type: 'insert' });

    const raw = await db.raw('SELECT * FROM t', []);
    expect(raw.rowCount).toBe(1);
    expect(raw.rows[0]).toEqual({ id: 1, name: 'Alice' });

    await db.beginTransaction();
    await db.commit();
    await db.rollback();

    await db.disconnect();
    await db.close();
  });

  it('run() returns insertId for INSERT and omits insertId when unavailable', async () => {
    await db.execute({ sql: 'CREATE TABLE posts (id, title)', bindings: [], type: 'schema' });

    const inserted = await db.run('INSERT INTO posts (title) VALUES (?)', ['First']);
    expect(inserted.affectedRows).toBe(1);
    expect(inserted.insertId).toBe(1);

    const selected = await db.run('SELECT * FROM posts', []);
    expect(selected.insertId).toBeUndefined();
    expect(selected.affectedRows).toBe(1);
  });

  it('reset() clears everything', async () => {
    await db.execute({ sql: 'CREATE TABLE t (id)', bindings: [], type: 'schema' });
    db.reset();
    expect(db.getTableNames()).toHaveLength(0);
  });
});
