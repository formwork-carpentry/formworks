# Formworks

[![Build](https://github.com/formwork-carpentry/formworks/actions/workflows/build.yml/badge.svg)](https://github.com/formwork-carpentry/formworks/actions/workflows/build.yml)
[![Test](https://github.com/formwork-carpentry/formworks/actions/workflows/test.yml/badge.svg)](https://github.com/formwork-carpentry/formworks/actions/workflows/test.yml)
[![Security](https://github.com/formwork-carpentry/formworks/actions/workflows/security.yml/badge.svg)](https://github.com/formwork-carpentry/formworks/actions/workflows/security.yml)
[![codecov](https://codecov.io/gh/formwork-carpentry/formworks/branch/main/graph/badge.svg)](https://codecov.io/gh/formwork-carpentry/formworks)
[![npm](https://img.shields.io/npm/v/@formwork/core?label=%40formwork%2Fcore)](https://www.npmjs.com/package/@formwork/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Formworks is the package monorepo powering the **Carpenter** framework ecosystem. It contains modular framework packages, adapters, testing utilities, and integration tooling — following the same philosophy as Laravel/Illuminate.

> 📦 **Package namespace**: `@formwork/*`  
> 🔨 **Framework**: [Carpenter](https://github.com/formwork-carpentry)  
> 🏗 **Organization**: [formwork-carpentry](https://github.com/formwork-carpentry)

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| `@formwork/core` | IoC container, config, env, exceptions | [![npm](https://img.shields.io/npm/v/@formwork/core)](https://www.npmjs.com/package/@formwork/core) |
| `@formwork/http` | HTTP server & routing | [![npm](https://img.shields.io/npm/v/@formwork/http)](https://www.npmjs.com/package/@formwork/http) |
| `@formwork/orm` | Database ORM abstraction | [![npm](https://img.shields.io/npm/v/@formwork/orm)](https://www.npmjs.com/package/@formwork/orm) |
| `@formwork/auth` | Authentication & authorization | [![npm](https://img.shields.io/npm/v/@formwork/auth)](https://www.npmjs.com/package/@formwork/auth) |
| `@formwork/cache` | Caching abstractions | [![npm](https://img.shields.io/npm/v/@formwork/cache)](https://www.npmjs.com/package/@formwork/cache) |
| `@formwork/queue` | Job queue abstractions | [![npm](https://img.shields.io/npm/v/@formwork/queue)](https://www.npmjs.com/package/@formwork/queue) |
| `@formwork/mail` | Mail service | [![npm](https://img.shields.io/npm/v/@formwork/mail)](https://www.npmjs.com/package/@formwork/mail) |
| `@formwork/storage` | File storage abstractions | [![npm](https://img.shields.io/npm/v/@formwork/storage)](https://www.npmjs.com/package/@formwork/storage) |
| `@formwork/cli` | Carpenter CLI | [![npm](https://img.shields.io/npm/v/@formwork/cli)](https://www.npmjs.com/package/@formwork/cli) |
| `@formwork/validation` | Input validation | [![npm](https://img.shields.io/npm/v/@formwork/validation)](https://www.npmjs.com/package/@formwork/validation) |
| `@formwork/testing` | Testing helpers & utilities | [![npm](https://img.shields.io/npm/v/@formwork/testing)](https://www.npmjs.com/package/@formwork/testing) |

## Getting Started

### Prerequisites

- Node.js 20+ or 22+ (LTS recommended)
- npm 10+
- Docker (for integration tests)

### Installation

```bash
# Install all workspace dependencies
npm install

# Build all packages
npm run build

# Type-check
npm run typecheck

# Lint
npm run lint
```

### Testing

```bash
# Unit tests (all packages)
npm run test:all

# Integration tests (requires Docker)
npm run test:integration

# Start services and keep them running
npm run test:integration:keep-up
```

## Repository Layout

```
formworks/
├── packages/               # All @formwork/* packages
│   ├── core/               # IoC container, config, env
│   ├── http/               # HTTP server & routing
│   ├── orm/                # Database ORM
│   ├── auth/               # Authentication
│   ├── cache/              # Caching
│   ├── cache-adapters/     # Redis, memory adapters
│   ├── queue/              # Job queues
│   ├── queue-adapters/     # BullMQ adapter
│   ├── mail/               # Mail service
│   ├── mail-adapters/      # SMTP, etc.
│   ├── storage/            # File storage
│   ├── cli/                # Carpenter CLI
│   └── ...                 # 40+ packages total
├── tests/                  # Integration & regression tests
├── docs/                   # Architecture docs and standards
├── scripts/                # Release & automation scripts
└── .github/                # CI/CD workflows & templates
```

## Quality Standards

- TypeScript-first implementation with strict mode
- Strict lint and type-check via Biome
- Testability by design with explicit seams
- Conventional commits enforced
- Automated security scanning
- Codecov coverage tracking
- Automated dependency updates via Dependabot

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) to get started.

- 🐛 [Report a bug](./.github/ISSUE_TEMPLATE/bug_report.yml)
- 💡 [Request a feature](./.github/ISSUE_TEMPLATE/feature_request.yml)
- ❓ [Ask a question](./.github/ISSUE_TEMPLATE/question.yml)

## Security

For security vulnerability reports, please use [GitHub's private vulnerability disclosure](https://github.com/formwork-carpentry/formworks/security/advisories/new). See [SECURITY.md](./SECURITY.md) for details.

## License

MIT © [formwork-carpentry](https://github.com/formwork-carpentry)
