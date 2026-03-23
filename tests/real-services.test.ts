/**
 * @module carpenter
 * @description Real-service integration tests — exercises PostgreSQL, MySQL, NATS, and Kafka
 * using the live Docker Compose stack started by `npm run docker:up`.
 *
 * Run via: npm test  (lifecycle: docker:up → docker:test → vitest → docker:down)
 * Run manually with stack kept running: npm run test:integration:keep-up
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresAdapter } from '@carpentry/db-postgres';
import { MySQLAdapter } from '@carpentry/db-mysql';
import { NatsTransport, NatsBridgeServer } from '@carpentry/bridge-nats';
import { KafkaTransport, KafkaBridgeServer } from '@carpentry/bridge-kafka';
import type { BridgeMessage } from '@carpentry/core/contracts';

// ── Compose service coordinates (must match docker-compose.yml) ────

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
} as const;

const MYSQL_CONFIG = {
  host: 'localhost',
  port: 3306,
  database: 'carpenter',
  user: 'root',
  password: 'root',
} as const;

const NATS_URL = 'nats://localhost:4222';

const KAFKA_BASE = {
  brokers: ['localhost:9092'] as string[],
  requestTopic: 'carpenter.real.requests',
  responseTopicPrefix: 'carpenter.real.responses',
  startupDelayMs: 500,
  requestTimeoutMs: 10_000,
};

// ── PostgreSQL ────────────────────────────────────────────

describe('PostgresAdapter — live pg connection', { timeout: 15_000 }, () => {
  let adapter: PostgresAdapter;

  beforeAll(async () => {
    adapter = new PostgresAdapter(PG_CONFIG);
    await adapter.connect();
    await adapter.raw(
      'CREATE TABLE IF NOT EXISTS _carpenter_pg_test (id SERIAL PRIMARY KEY, label TEXT NOT NULL)',
    );
    await adapter.raw("DELETE FROM _carpenter_pg_test");
  });

  afterAll(async () => {
    await adapter.raw('DROP TABLE IF EXISTS _carpenter_pg_test');
    await adapter.disconnect();
  });

  it('responds to a raw SELECT ping', async () => {
    const result = await adapter.raw<{ ping: number }>('SELECT 1 AS ping');
    expect(result.rows[0]).toEqual({ ping: 1 });
  });

  it('inserts a row and reads it back', async () => {
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_pg_test (label) VALUES ($1)',
      bindings: ['hello_postgres'],
      type: 'insert',
    });
    const result = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_pg_test WHERE label = 'hello_postgres'",
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].label).toBe('hello_postgres');
  });

  it('commits a transaction', async () => {
    await adapter.beginTransaction();
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_pg_test (label) VALUES ($1)',
      bindings: ['txn_commit'],
      type: 'insert',
    });
    await adapter.commit();
    const result = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_pg_test WHERE label = 'txn_commit'",
    );
    expect(result.rows).toHaveLength(1);
  });

  it('rolls back a transaction', async () => {
    await adapter.beginTransaction();
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_pg_test (label) VALUES ($1)',
      bindings: ['txn_rollback'],
      type: 'insert',
    });
    await adapter.rollback();
    const result = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_pg_test WHERE label = 'txn_rollback'",
    );
    expect(result.rows).toHaveLength(0);
  });
});

// ── MySQL ─────────────────────────────────────────────────

describe('MySQLAdapter — live mysql2 connection', { timeout: 15_000 }, () => {
  let adapter: MySQLAdapter;

  beforeAll(async () => {
    adapter = new MySQLAdapter(MYSQL_CONFIG);
    await adapter.connect();
    await adapter.raw(
      'CREATE TABLE IF NOT EXISTS _carpenter_mysql_test (id INT AUTO_INCREMENT PRIMARY KEY, label VARCHAR(255) NOT NULL)',
    );
    await adapter.raw('DELETE FROM _carpenter_mysql_test');
  });

  afterAll(async () => {
    await adapter.raw('DROP TABLE IF EXISTS _carpenter_mysql_test');
    await adapter.disconnect();
  });

  it('responds to a raw SELECT ping', async () => {
    const result = await adapter.raw<{ ping: number }>('SELECT 1 AS ping');
    expect(result.rows[0]).toEqual({ ping: 1 });
  });

  it('inserts a row and reads it back', async () => {
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_mysql_test (label) VALUES (?)',
      bindings: ['hello_mysql'],
      type: 'insert',
    });
    const result = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_mysql_test WHERE label = 'hello_mysql'",
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].label).toBe('hello_mysql');
  });

  it('commits a transaction', async () => {
    await adapter.beginTransaction();
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_mysql_test (label) VALUES (?)',
      bindings: ['txn_commit_mysql'],
      type: 'insert',
    });
    await adapter.commit();
    const result = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_mysql_test WHERE label = 'txn_commit_mysql'",
    );
    expect(result.rows).toHaveLength(1);
  });

  it('rolls back a transaction', async () => {
    await adapter.beginTransaction();
    await adapter.execute({
      sql: 'INSERT INTO _carpenter_mysql_test (label) VALUES (?)',
      bindings: ['txn_rollback_mysql'],
      type: 'insert',
    });
    await adapter.rollback();
    const result = await adapter.raw<{ label: string }>(
      "SELECT label FROM _carpenter_mysql_test WHERE label = 'txn_rollback_mysql'",
    );
    expect(result.rows).toHaveLength(0);
  });
});

// ── NATS ─────────────────────────────────────────────────

describe('NatsTransport — live NATS round-trip', { timeout: 15_000 }, () => {
  let server: NatsBridgeServer;
  let transport: NatsTransport;

  beforeAll(async () => {
    server = new NatsBridgeServer({ server: NATS_URL, subjectPrefix: 'real.test' });
    server.onRequest('GreetService', async (req) => ({
      id: req.id,
      data: { greeting: `Hello, ${(req.payload as { name: string }).name}!` },
    }));
    await server.connect();

    transport = new NatsTransport({ server: NATS_URL, subjectPrefix: 'real.test' });
    await transport.connect();
  });

  afterAll(async () => {
    await transport.disconnect();
    await server.disconnect();
  });

  it('reports both sides as connected', () => {
    expect(transport.isConnected()).toBe(true);
    expect(server.isConnected()).toBe(true);
  });

  it('sends a request and receives a response', async () => {
    const msg: BridgeMessage<{ name: string }> = {
      id: 'nats-real-1',
      service: 'GreetService',
      method: 'greet',
      payload: { name: 'Carpenter' },
      timestamp: Date.now(),
    };
    const response = await transport.send(msg);
    expect(response.error).toBeUndefined();
    expect(response.data).toEqual({ greeting: 'Hello, Carpenter!' });
  });

  it('returns an error response for an unregistered service', async () => {
    const msg: BridgeMessage = {
      id: 'nats-real-2',
      service: 'NoSuchService',
      method: 'call',
      payload: {},
      timestamp: Date.now(),
    };
    const response = await transport.send(msg);
    expect(response.error).toBeDefined();
  });
});

// ── Kafka ─────────────────────────────────────────────────

/** Kafka group coordinator may not be ready immediately on a fresh container.
 *  Retry the connect() up to maxAttempts times before failing. */
async function connectWithRetry<T extends { connect(): Promise<void> }>(
  createInstance: () => T,
  maxAttempts = 5,
  delayMs = 3_000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const instance = createInstance();
    try {
      await instance.connect();
      return instance;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

describe('KafkaTransport — live Kafka round-trip', { timeout: 60_000 }, () => {
  let server: KafkaBridgeServer;
  let transport: KafkaTransport;

  beforeAll(async () => {
    server = await connectWithRetry(() => {
      const s = new KafkaBridgeServer({
        ...KAFKA_BASE,
        clientId: 'carpenter-real-test-server',
        consumerGroupId: 'carpenter-real-test-server-cg',
      });
      s.onRequest('EchoService', async (req) => ({
        id: req.id,
        data: { echo: (req.payload as { text: string }).text },
      }));
      return s;
    });

    transport = await connectWithRetry(() =>
      new KafkaTransport({
        ...KAFKA_BASE,
        clientId: 'carpenter-real-test-client',
        consumerGroupId: 'carpenter-real-test-client-cg',
      }),
    );
  }, 60_000);

  afterAll(async () => {
    await transport.disconnect();
    await server.disconnect();
  });

  it('reports both sides as connected', () => {
    expect(transport.isConnected()).toBe(true);
    expect(server.isConnected()).toBe(true);
  });

  it('sends a request and receives an echo response', async () => {
    const msg: BridgeMessage<{ text: string }> = {
      id: 'kafka-real-1',
      service: 'EchoService',
      method: 'echo',
      payload: { text: 'hello-kafka' },
      timestamp: Date.now(),
    };
    const response = await transport.send(msg);
    expect(response.error).toBeUndefined();
    expect(response.data).toEqual({ echo: 'hello-kafka' });
  });
});
