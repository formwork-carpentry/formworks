# @carpentry/cache

Cache manager with pluggable adapters (Redis, Memory, File, Null)

## Highlights

- Stable module boundaries and ESM-first design
- TypeScript-first developer experience
- Compatible with npm, pnpm, and Bun workflows

## Installation

```bash
npm install @carpentry/cache
```

## Quick Start

```ts
import * as formworkcache from '@carpentry/cache';

// Use the package API in your application modules
```

## Scripts

| Script | Command |
| --- | --- |
| build | tsc -b |
| test | vitest run |
| typecheck | tsc --noEmit |
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
