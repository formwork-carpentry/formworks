import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: [
			{
				find: '@carpentry/db-memory',
				replacement: path.resolve(__dirname, '../packages/db-memory/src/index.ts'),
			},
			{
				find: '@carpentry/db-postgres',
				replacement: path.resolve(__dirname, '../packages/db-postgres/src/index.ts'),
			},
			{
				find: '@carpentry/db-mysql',
				replacement: path.resolve(__dirname, '../packages/db-mysql/src/index.ts'),
			},
			{
				find: '@carpentry/db-sqlite',
				replacement: path.resolve(__dirname, '../packages/db-sqlite/src/index.ts'),
			},
			{
				find: '@carpentry/db-mongodb',
				replacement: path.resolve(__dirname, '../packages/db-mongodb/src/index.ts'),
			},
			{
				find: '@carpentry/db-filesystem',
				replacement: path.resolve(__dirname, '../packages/db-filesystem/src/index.ts'),
			},
			{
				find: '@carpentry/storage-s3',
				replacement: path.resolve(__dirname, '../packages/storage-s3/src/index.ts'),
			},
			{
				find: '@carpentry/bridge-grpc',
				replacement: path.resolve(__dirname, '../packages/bridge-grpc/src/index.ts'),
			},
			{
				find: '@carpentry/bridge-kafka',
				replacement: path.resolve(__dirname, '../packages/bridge-kafka/src/index.ts'),
			},
			{
				find: '@carpentry/bridge-nats',
				replacement: path.resolve(__dirname, '../packages/bridge-nats/src/index.ts'),
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
