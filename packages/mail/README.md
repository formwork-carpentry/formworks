# @formwork/mail

Mail manager with pluggable adapters (SMTP, SES, Mailgun, Resend)

## Highlights

- Stable module boundaries and ESM-first design
- TypeScript-first developer experience
- Compatible with npm, pnpm, and Bun workflows

## Installation

```bash
npm install @formwork/mail
```

## Quick Start

```ts
import * as formworkmail from '@formwork/mail';

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
