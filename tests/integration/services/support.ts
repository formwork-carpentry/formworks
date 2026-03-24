import { PostgresAdapter } from '@carpentry/db-postgres';
import { MySQLAdapter } from '@carpentry/db-mysql';
import { NatsTransport, NatsBridgeServer } from '@carpentry/bridge-nats';
import { KafkaTransport, KafkaBridgeServer } from '@carpentry/bridge-kafka';

export const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
} as const;

export const MYSQL_CONFIG = {
  host: 'localhost',
  port: 3306,
  database: 'carpenter',
  user: 'root',
  password: 'root',
} as const;

export const NATS_URL = 'nats://localhost:4222';

export const KAFKA_BASE = {
  brokers: ['localhost:9092'] as string[],
  requestTopic: 'carpenter.real.requests',
  responseTopicPrefix: 'carpenter.real.responses',
  startupDelayMs: 500,
  requestTimeoutMs: 10_000,
};

export type RealServiceTypes = {
  PostgresAdapter: PostgresAdapter;
  MySQLAdapter: MySQLAdapter;
  NatsTransport: NatsTransport;
  NatsBridgeServer: NatsBridgeServer;
  KafkaTransport: KafkaTransport;
  KafkaBridgeServer: KafkaBridgeServer;
};

export async function connectWithRetry<T extends { connect(): Promise<void> }>(
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
