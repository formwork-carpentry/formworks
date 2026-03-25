
# ADR 0001: Use npm Workspaces + Turborepo for Monorepo Management

**Navigation:**
- [Milestone Closure Matrix](../status/MILESTONE-CLOSURE-MATRIX.md)
- [Release Checklist](../status/RELEASE-CHECKLIST.md)
- [Remaining Work](../status/REMAINING-WORK.md)

**Status:** Accepted
**Date:** 2026-01-01
**Authors:** Formworks Team
**Deciders:** Architecture Team

## Context

The Formworks project aims to manage and maintain 40+ interdependent TypeScript packages under the `@carpentry/*` namespace. Key challenges include:

1. **Dependency Management**: Ensuring consistent versions across multiple packages while allowing for independent updates
2. **Build Optimization**: Avoiding redundant builds when only specific packages change
3. **Task Orchestration**: Running tests, linting, and builds across 40+ packages efficiently
4. **Developer Experience**: Keeping setup and workflow simple for contributors
5. **Code Sharing**: Efficient management of shared utilities and patterns across packages

Previous approaches considered:
- **Lerna**: Mature but adds complexity; npm workspaces now provide similar functionality
- **pnpm Workspaces**: Excellent but requires all contributors to use pnpm exclusively
- **Yarn Workspaces**: Good but npm workspaces are now built-in and standard

## Decision

We will use:

1. **npm Workspaces** for dependency management
   - Built-in to npm v7+
   - No additional CLI tool required
   - Native integration with standard `npm install` and `npm publish` workflows

2. **Turborepo** for task orchestration
   - Efficient caching and incremental builds
   - Parallel task execution with dependency awareness
   - Clear visualization of task execution
   - Minimal configuration required
   - Community support and active development

## Rationale

### npm Workspaces

- **Standard**: No external dependency for basic monorepo functionality
- **Simplicity**: Works with existing npm tooling and CI/CD pipelines
- **Flexibility**: Package publishing is straightforward
- **Lock File**: Single `package-lock.json` ensures consistent installations

### Turborepo

- **Performance**: Intelligent caching reduces build times significantly
- **Simplicity**: Requires minimal configuration compared to alternatives
- **Transparency**: Clear task graph visualization
- **Scalability**: Handles 40+ packages without performance degradation
- **Remote Caching**: Optional support for distributed builds

## Consequences

### Positive

- **Unified Builds**: Single `package-lock.json` ensures consistency across all packages
- **Shared Dependencies**: Common dependencies are installed once at the root
- **Efficient CI/CD**: Turborepo caching reduces CI pipeline duration
- **Clear Structure**: Monorepo structure is immediately familiar to Node.js developers
- **Independent Releases**: Each package can be released independently
- **Simplified Publishing**: npm publish works naturally with workspaces

### Negative

- **Tooling Complexity**: Developers must understand both npm workspaces and Turborepo
- **Debugging**: Cross-package debugging can be more complex
- **Version Coordination**: Semantic versioning across 40+ packages requires discipline
- **Learning Curve**: Contributors unfamiliar with monorepos need onboarding
- **Disk Space**: Hoisting and node_modules structure can be large
- **Interdependency Management**: Must be careful about circular dependencies

## Alternatives Considered

### 1. Lerna + npm Workspaces
- **Pros**: Mature, battle-tested, excellent publishing tooling
- **Cons**: Additional abstraction layer, npm workspaces now reduce the need

### 2. pnpm Workspaces + Turborepo
- **Pros**: Better disk space usage, faster installations
- **Cons**: Requires pnpm for all contributors, reduces accessibility

### 3. Yarn Workspaces
- **Pros**: Good performance, decent tooling
- **Cons**: npm workspaces now provide equivalent functionality natively

### 4. Single Package
- **Pros**: Simplicity, no monorepo complexity
- **Cons**: Cannot manage 40+ packages effectively

## Implementation

### npm Workspaces Configuration

Root `package.json`:
```json
{
  "name": "formworks",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ]
}
```

### Turborepo Configuration

Root `turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

### Directory Structure

```
formworks/
├── packages/
│   ├── @carpentry/core/
│   ├── @carpentry/cli/
│   ├── @carpentry/utils/
│   └── ... (37+ more packages)
├── scripts/
├── docs/
├── turbo.json
└── package.json
```

## Related Decisions

- ADR 0002: Package Naming Convention (to be created)
- ADR 0003: Release Strategy (to be created)

## References

- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [Turborepo Documentation](https://turbo.build)
- [Node.js Monorepo Best Practices](https://nodejs.org/en/docs/guides/nodejs-monorepos/)
