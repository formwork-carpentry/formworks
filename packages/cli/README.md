# @carpentry/cli

carpenter CLI: generators, migrations, serve, build

## Highlights

- Stable module boundaries and ESM-first design
- TypeScript-first developer experience
- Compatible with npm, pnpm, and Bun workflows

## Installation

```bash
npm install @carpentry/cli
```

## Quick Start

```ts
import * as formworkcli from '@carpentry/cli';

// Use the package API in your application modules
```

## Scripts

| Script | Command |
| --- | --- |
| build | tsc -p tsconfig.json |
| test | vitest run |
| typecheck | tsc --noEmit -p tsconfig.json |
| clean | rm -rf dist |
| lint | biome check src/ |

## Development

1. Install dependencies with `npm install` (or your package manager of choice).
2. Build with `npm run build`.
3. Run tests with `npm test` where available.

## Package Metadata

- Version: 1.0.0-alpha.0
- License: MIT
- Module Type: module
