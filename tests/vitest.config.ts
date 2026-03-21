import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: [
			{
				find: '@formwork/db-memory',
				replacement: path.resolve(__dirname, '../packages/db-adapters/memorydb/src/index.ts'),
			},
			{
				find: '@formwork/db-postgres',
				replacement: path.resolve(__dirname, '../packages/db-adapters/postgres/src/index.ts'),
			},
			{
				find: '@formwork/db-mysql',
				replacement: path.resolve(__dirname, '../packages/db-adapters/mysql/src/index.ts'),
			},
			{
				find: '@formwork/db-sqlite',
				replacement: path.resolve(__dirname, '../packages/db-adapters/sqlite/src/index.ts'),
			},
			{
				find: '@formwork/db-mongodb',
				replacement: path.resolve(__dirname, '../packages/db-adapters/mongodb/src/index.ts'),
			},
			{
				find: '@formwork/db-filesystem',
				replacement: path.resolve(__dirname, '../packages/db-adapters/filesystem/src/index.ts'),
			},
			{
				find: '@formwork/storage-s3',
				replacement: path.resolve(__dirname, '../packages/storage-adapters/s3/src/index.ts'),
			},
			{
				find: '@formwork/bridge-grpc',
				replacement: path.resolve(__dirname, '../packages/bridge-adapters/grpc/src/index.ts'),
			},
			{
				find: '@formwork/bridge-kafka',
				replacement: path.resolve(__dirname, '../packages/bridge-adapters/kafka/src/index.ts'),
			},
			{
				find: '@formwork/bridge-nats',
				replacement: path.resolve(__dirname, '../packages/bridge-adapters/nats/src/index.ts'),
			},
			{
				find: /^@formwork\/([a-z0-9-]+)$/,
				replacement: path.resolve(__dirname, '../packages/$1/src/index.ts'),
			},
			{
				find: /^@formwork\/([a-z0-9-]+)\/(.+)$/,
				replacement: path.resolve(__dirname, '../packages/$1/src/$2.ts'),
			},
		],
	},
	test: {
		include: ['**/*.test.ts'],
		globals: true,
	},
});
