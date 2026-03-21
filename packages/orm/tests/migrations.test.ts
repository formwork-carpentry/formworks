/**
 * @module @formwork/orm
 * @description Tests for Migration system (CARP-020) and Factory/Seeder (CARP-021)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Schema, Blueprint, MigrationRunner } from '../src/migrations/Migration.js';
import type { MigrationClass } from '../src/migrations/Migration.js';
import { ModelFactory, defineFactory, BaseSeeder } from '../src/seeders/Factory.js';
import { BaseModel } from '../src/model/BaseModel.js';
import { MockDatabaseAdapter } from '../src/adapters/MockDatabaseAdapter.js';

let db: MockDatabaseAdapter;

beforeEach(() => {
  db = new MockDatabaseAdapter();
  BaseModel.adapter = db;
  BaseModel.clearEvents();
});

// ── CARP-020: Migrations ──────────────────────────────────

describe('CARP-020: Blueprint', () => {
  it('defines an id column', () => {
    const bp = new Blueprint('users');
    bp.id();
    expect(bp.columns).toHaveLength(1);
    expect(bp.columns[0].name).toBe('id');
    expect(bp.columns[0].type).toBe('id');
    expect(bp.columns[0].primaryKey).toBe(true);
    expect(bp.columns[0].autoIncrement).toBe(true);
  });

  it('defines string columns with length', () => {
    const bp = new Blueprint('users');
    bp.string('name', 100);
    expect(bp.columns[0].type).toBe('string');
    expect(bp.columns[0].length).toBe(100);
  });

  it('supports nullable modifier', () => {
    const bp = new Blueprint('users');
    bp.string('bio').nullable();
    expect(bp.columns[0].nullable).toBe(true);
  });

  it('supports default values', () => {
    const bp = new Blueprint('users');
    bp.boolean('active').default(true);
    expect(bp.columns[0].defaultValue).toBe(true);
  });

  it('supports unique modifier', () => {
    const bp = new Blueprint('users');
    bp.string('email').unique();
    expect(bp.columns[0].unique).toBe(true);
  });

  it('defines enum columns with allowed values', () => {
    const bp = new Blueprint('users');
    bp.enum('role', ['admin', 'user']).default('user');
    expect(bp.columns[0].type).toBe('enum');
    expect(bp.columns[0].enumValues).toEqual(['admin', 'user']);
    expect(bp.columns[0].defaultValue).toBe('user');
  });

  it('defines table-level indexes', () => {
    const bp = new Blueprint('notifications');
    bp.index(['notifiable_id', 'notifiable_type']);
    expect(bp.indexes).toHaveLength(1);
    expect(bp.indexes[0]).toEqual({
      columns: ['notifiable_id', 'notifiable_type'],
      name: 'notifications_notifiable_id_notifiable_type_index',
    });
  });

  it('defines timestamps()', () => {
    const bp = new Blueprint('users');
    bp.timestamps();
    expect(bp.columns).toHaveLength(2);
    expect(bp.columns[0].name).toBe('created_at');
    expect(bp.columns[1].name).toBe('updated_at');
    expect(bp.columns[0].nullable).toBe(true);
  });

  it('defines softDeletes()', () => {
    const bp = new Blueprint('posts');
    bp.softDeletes();
    expect(bp.columns).toHaveLength(1);
    expect(bp.columns[0].name).toBe('deleted_at');
    expect(bp.columns[0].nullable).toBe(true);
  });

  it('defines foreignId with constrained()', () => {
    const bp = new Blueprint('posts');
    bp.foreignId('user_id').constrained();
    const col = bp.columns[0];
    expect(col.type).toBe('bigInteger');
    expect(col.unsigned).toBe(true);
    expect(col.references).toBeDefined();
    expect(col.references!.table).toBe('users');
    expect(col.references!.column).toBe('id');
    expect(col.references!.onDelete).toBe('cascade');
  });

  it('supports references().on() on a standard column', () => {
    const bp = new Blueprint('memberships');
    bp.integer('user_id').references('id').on('users');
    const col = bp.columns[0];
    expect(col.references).toBeDefined();
    expect(col.references!.table).toBe('users');
    expect(col.references!.column).toBe('id');
  });

  it('supports foreign() on an existing column without duplicating it', () => {
    const bp = new Blueprint('posts');
    bp.integer('author_id');
    bp.foreign('author_id').references('id').on('users');

    expect(bp.columns).toHaveLength(1);
    expect(bp.columns[0].name).toBe('author_id');
    expect(bp.columns[0].references).toBeDefined();
    expect(bp.columns[0].references!.table).toBe('users');
  });

  it('defines all column types', () => {
    const bp = new Blueprint('test');
    bp.id();
    bp.uuid('uuid_col');
    bp.string('str');
    bp.text('txt');
    bp.integer('int');
    bp.bigInteger('big');
    bp.float('flt');
    bp.decimal('dec', 10, 4);
    bp.boolean('bool');
    bp.date('dt');
    bp.datetime('dttm');
    bp.timestamp('ts');
    bp.json('data');
    bp.binary('bin');
    bp.enum('state', ['draft', 'published']);

    expect(bp.columns).toHaveLength(15);
    expect(bp.columns.map((c) => c.type)).toEqual([
      'id', 'uuid', 'string', 'text', 'integer', 'bigInteger',
      'float', 'decimal', 'boolean', 'date', 'datetime', 'timestamp',
      'json', 'binary', 'enum',
    ]);
  });
});

describe('CARP-020: Schema.create()', () => {
  it('compiles a CREATE TABLE statement', async () => {
    const schema = new Schema(db);
    db.queueResult([]); // for the CREATE TABLE execution

    await schema.create('users', (table) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.timestamps();
    });

    db.assertExecuted('CREATE TABLE users');
    const sql = db.lastQuery()!.sql;
    expect(sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(sql).toContain('name VARCHAR(255) NOT NULL');
    expect(sql).toContain('email VARCHAR(255) NOT NULL UNIQUE');
    expect(sql).toContain('created_at TIMESTAMP');
    expect(sql).toContain('updated_at TIMESTAMP');
  });

  it('compiles foreign key constraints', async () => {
    const schema = new Schema(db);
    db.queueResult([]);

    await schema.create('posts', (table) => {
      table.id();
      table.string('title');
      table.foreignId('user_id').constrained();
    });

    const sql = db.lastQuery()!.sql;
    expect(sql).toContain('FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
  });

  it('compiles enum columns and explicit references().on() chains', async () => {
    const schema = new Schema(db);
    db.queueResult([]);

    await schema.create('subscriptions', (table) => {
      table.id();
      table.enum('status', ['active', 'canceled']).default('active');
      table.integer('org_id').references('id').on('organizations');
    });

    const sql = db.lastQuery()!.sql;
    expect(sql).toContain("status VARCHAR(255) NOT NULL DEFAULT 'active'");
    expect(sql).toContain('FOREIGN KEY (org_id) REFERENCES organizations(id)');
  });

  it('compiles table-level indexes as CREATE INDEX statements', async () => {
    const schema = new Schema(db);
    db.queueResult([]);
    db.queueResult([]);

    await schema.create('notifications', (table) => {
      table.id();
      table.string('type');
      table.index(['type']);
    });

    db.assertExecuted('CREATE TABLE notifications');
    db.assertExecuted('CREATE INDEX notifications_type_index ON notifications (type)');
  });

  it('dropIfExists() compiles DROP TABLE IF EXISTS', async () => {
    const schema = new Schema(db);
    db.queueResult([]);
    await schema.dropIfExists('users');
    db.assertExecuted('DROP TABLE IF EXISTS users');
  });
});

describe('CARP-020: MigrationRunner', () => {
  const migrations: MigrationClass[] = [
    {
      name: '001_create_users',
      async up(schema) { await schema.create('users', (t) => { t.id(); t.string('name'); }); },
      async down(schema) { await schema.dropIfExists('users'); },
    },
    {
      name: '002_create_posts',
      async up(schema) { await schema.create('posts', (t) => { t.id(); t.string('title'); }); },
      async down(schema) { await schema.dropIfExists('posts'); },
    },
  ];

  it('runs pending migrations', async () => {
    const runner = new MigrationRunner(db);

    // 1. ensureMigrationsTable
    db.queueResult([]);
    // 2. SELECT ran migrations (none)
    db.queueResult([]);
    // 3. SELECT max batch
    db.queueResult([{ max_batch: 0 }]);
    // 4. CREATE TABLE users
    db.queueResult([]);
    // 5. INSERT migration record
    db.queueResult([]);
    // 6. CREATE TABLE posts
    db.queueResult([]);
    // 7. INSERT migration record
    db.queueResult([]);

    const migrated = await runner.migrate(migrations);

    expect(migrated).toEqual(['001_create_users', '002_create_posts']);
    db.assertExecuted('CREATE TABLE users');
    db.assertExecuted('CREATE TABLE posts');
    db.assertExecuted('INSERT INTO carpenter_migrations');
  });

  it('skips already-run migrations', async () => {
    const runner = new MigrationRunner(db);

    // ensureMigrationsTable
    db.queueResult([]);
    // Already ran: first migration
    db.queueResult([{ name: '001_create_users' }]);
    // max batch
    db.queueResult([{ max_batch: 1 }]);
    // CREATE posts only
    db.queueResult([]);
    // INSERT record
    db.queueResult([]);

    const migrated = await runner.migrate(migrations);
    expect(migrated).toEqual(['002_create_posts']);
  });

  it('returns empty when all migrations are run', async () => {
    const runner = new MigrationRunner(db);

    db.queueResult([]); // ensure table
    db.queueResult([{ name: '001_create_users' }, { name: '002_create_posts' }]); // all run

    const migrated = await runner.migrate(migrations);
    expect(migrated).toEqual([]);
  });

  it('rollback reverses last batch', async () => {
    const runner = new MigrationRunner(db);

    db.queueResult([]); // ensure table
    // max batch = 2
    db.queueResult([{ max_batch: 2 }]);
    // batch 2 migrations
    db.queueResult([{ name: '002_create_posts', batch: 2 }]);
    // DROP TABLE posts
    db.queueResult([]);
    // DELETE migration record
    db.queueResult([]);

    const rolled = await runner.rollback(migrations);
    expect(rolled).toEqual(['002_create_posts']);
    db.assertExecuted('DROP TABLE IF EXISTS posts');
  });

  it('getRanMigrations() lists run migration names', async () => {
    const runner = new MigrationRunner(db);
    db.queueResult([{ name: '001_create_users' }, { name: '002_create_posts' }]);

    const ran = await runner.getRanMigrations();
    expect(ran).toEqual(['001_create_users', '002_create_posts']);
  });
});

// ── CARP-021: Factory & Seeder ────────────────────────────

class User extends BaseModel {
  static table = 'users';
  static fillable = ['name', 'email', 'role', 'slug'];
}

describe('CARP-021: ModelFactory', () => {
  let counter = 0;

  const userFactory = defineFactory(User, () => {
    counter++;
    return { name: `User ${counter}`, email: `user${counter}@ex.com`, role: 'user' };
  });

  beforeEach(() => {
    counter = 0;
  });

  it('make() builds without saving', () => {
    const user = userFactory.make() as User;
    expect(user).toBeInstanceOf(User);
    expect(user.getAttribute('name')).toBe('User 1');
    expect(user.exists()).toBe(false);
    db.assertQueryCount(0); // no DB call
  });

  it('make() accepts overrides', () => {
    const user = userFactory.make({ name: 'Custom' }) as User;
    expect(user.getAttribute('name')).toBe('Custom');
    expect(user.getAttribute('email')).toContain('@ex.com'); // from definition
  });

  it('count() builds multiple', () => {
    const users = userFactory.count(3).make() as User[];
    expect(users).toHaveLength(3);
    expect(users[0].getAttribute('name')).toBe('User 1');
    expect(users[2].getAttribute('name')).toBe('User 3');
  });

  it('create() persists to database', async () => {
    db.queueResult([], 1, 1);
    const user = await userFactory.create() as User;
    expect(user.exists()).toBe(true);
    db.assertExecuted('INSERT INTO users');
  });

  it('count().create() persists multiple', async () => {
    db.queueResult([], 1, 1);
    db.queueResult([], 1, 2);
    const users = await userFactory.count(2).create() as User[];
    expect(users).toHaveLength(2);
    db.assertQueryCount(2);
  });

  it('state() defines attribute overrides', () => {
    const factory = defineFactory(User, () => ({
      name: 'Default', email: 'default@ex.com', role: 'user',
    }));
    factory.state('admin', () => ({ role: 'admin' }));

    const admin = factory.withState('admin').make() as User;
    expect(admin.getAttribute('role')).toBe('admin');
    expect(admin.getAttribute('name')).toBe('Default'); // other attrs preserved
  });

  it('withState() throws for unknown state', () => {
    const factory = defineFactory(User, () => ({ name: 'X' }));
    expect(() => factory.withState('nonexistent')).toThrow('not defined');
  });

  it('passes a deterministic faker instance into factory definitions', () => {
    const factory = defineFactory(User, (faker) => ({
      name: faker?.person.fullName() ?? 'fallback',
      email: faker?.internet.email() ?? 'fallback@test.com',
      slug: faker?.sequence((index) => `user-${index}`) ?? 'user-1',
    })).seed('orm-factory-seed');

    const first = factory.make() as User;
    const second = factory.seed('orm-factory-seed').make() as User;

    expect(first.getAttribute('name')).toBe(second.getAttribute('name'));
    expect(first.getAttribute('email')).toBe(second.getAttribute('email'));
    expect(first.getAttribute('slug')).toBe('user-1');
  });
});

describe('CARP-021: BaseSeeder', () => {
  it('run() is called', async () => {
    let ran = false;

    class TestSeeder extends BaseSeeder {
      async run() { ran = true; }
    }

    await new TestSeeder().run();
    expect(ran).toBe(true);
  });

  it('call() invokes another seeder', async () => {
    const order: string[] = [];

    class ChildSeeder extends BaseSeeder {
      async run() { order.push('child'); }
    }

    class ParentSeeder extends BaseSeeder {
      async run() {
        order.push('parent-before');
        await this.call(new ChildSeeder());
        order.push('parent-after');
      }
    }

    await new ParentSeeder().run();
    expect(order).toEqual(['parent-before', 'child', 'parent-after']);
  });
});
