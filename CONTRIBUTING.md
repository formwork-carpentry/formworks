# Contributing to Formworks

Thank you for your interest in contributing to Formworks — the package ecosystem powering the Carpenter framework! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Commit Convention](#commit-convention)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Package Development](#package-development)
- [Release Process](#release-process)

---

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md). We are committed to maintaining a welcoming, respectful community.

---

## Getting Started

### Prerequisites

- **Node.js** 20 or 22 (LTS recommended)
- **npm** 10+
- **Docker** (for integration tests)
- **TypeScript** knowledge

### Fork & Clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/<your-username>/formworks.git
cd formworks

# Add upstream remote
git remote add upstream https://github.com/formwork-carpentry/formworks.git
```

---

## Development Setup

```bash
# Install all workspace dependencies
npm install

# Build all packages
npm run build

# Lint all packages
npm run lint

# Type-check all packages
npm run typecheck

# Run unit tests
npm run test:all

# Run integration tests (requires Docker)
npm run test:integration
```

---

## Project Structure

```
formworks/
├── packages/               # All @formwork/* packages
│   ├── core/               # IoC container, config, env, exceptions
│   ├── http/               # HTTP server & routing
│   ├── orm/                # Database ORM abstraction
│   ├── auth/               # Authentication & authorization
│   ├── cache/              # Caching abstractions
│   ├── cache-adapters/     # Redis, memory, etc.
│   ├── queue/              # Job queue abstractions
│   ├── queue-adapters/     # BullMQ, etc.
│   ├── mail/               # Mail service
│   ├── storage/            # File storage abstractions
│   ├── cli/                # Carpenter CLI
│   └── ...                 # Other packages
├── tests/                  # Integration & regression tests
├── docs/                   # Architecture docs, plans, standards
├── scripts/                # Release & automation scripts
├── .github/                # GitHub Actions, templates, config
├── biome.json              # Linting & formatting configuration
├── tsconfig.base.json      # Shared TypeScript configuration
└── turbo.json              # Turborepo task configuration
```

---

## Making Changes

### Branch Naming

```
feat/short-description
fix/short-description
chore/short-description
docs/short-description
refactor/short-description
```

### Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-new-feature
   ```

2. **Make your changes** in the relevant package(s)

3. **Lint and type-check**:
   ```bash
   npm run lint
   npm run typecheck
   ```

4. **Build**:
   ```bash
   npm run build
   ```

5. **Test**:
   ```bash
   npm run test:all
   ```

6. **Commit** using conventional commits (see below)

7. **Push** and open a pull request

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons, etc. |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, tooling, dependencies |
| `ci` | CI configuration changes |
| `revert` | Revert a previous commit |

### Scopes

Use the package name as scope: `core`, `http`, `orm`, `auth`, `cache`, `cli`, etc.

### Examples

```
feat(cache): add Redis cluster support
fix(orm): resolve connection pool leak on shutdown
docs(http): update routing examples
chore(deps): upgrade vitest to 4.x
```

---

## Submitting a Pull Request

1. Ensure your branch is up to date with `main`:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Push your branch:
   ```bash
   git push origin feat/my-new-feature
   ```

3. Open a PR on GitHub using the pull request template

4. Fill out all sections of the PR template

5. Ensure all CI checks pass

6. Request a review from the relevant CODEOWNERS

---

## Package Development

### Adding a New Package

1. Create the package directory under `packages/`:
   ```bash
   mkdir packages/my-package
   cd packages/my-package
   ```

2. Create a `package.json` following the existing pattern:
   ```json
   {
     "name": "@formwork/my-package",
     "version": "1.0.0-alpha.0",
     "description": "...",
     "type": "module",
     "main": "./src/index.ts",
     "types": "./src/index.ts",
     "exports": {
       ".": "./src/index.ts"
     },
     "scripts": {
       "build": "tsc -b",
       "test": "vitest run",
       "typecheck": "tsc --noEmit",
       "clean": "rm -rf dist",
       "lint": "biome check src/"
     },
     "license": "MIT",
     "files": ["dist"]
   }
   ```

3. Add a `tsconfig.json` extending the base config

4. Add a `vitest.config.ts`

5. Create `src/index.ts` as the main entry point

6. Add the package to the root `package.json` workspaces array

### Code Standards

- **TypeScript-first**: All code must be strictly typed
- **ESM only**: Use `"type": "module"` and ESM imports
- **No default exports**: Prefer named exports
- **Explicit return types**: Always specify return types for public APIs
- **JSDoc**: Document all public APIs following `docs/JSDOC-STANDARDS.md`
- **Tests**: Every feature must have unit tests

---

## Release Process

Releases are managed by the core team. The process is:

1. Version bump via `npm run publish:dry` (review)
2. Tag creation: `git tag v1.x.x`
3. Push tag triggers the publish workflow
4. GitHub Release is automatically created

If you'd like to propose a release, open a discussion issue.

---

## Getting Help

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: File bugs and feature requests using the issue templates
- **Security**: See [SECURITY.md](./SECURITY.md) for vulnerability reporting

Thank you for contributing! 🔨
