# Formworks

Formworks is the package monorepo powering the Carpenter ecosystem. It contains modular framework packages, adapters, testing utilities, and integration tooling.

## Scope

- Core framework packages (HTTP, ORM, events, queue, storage, auth, validation, and more)
- Infrastructure adapters (database, cache, queue, mail, bridge, storage)
- Developer tooling (CLI primitives, testing helpers, docs, and scripts)

## Getting Started

```bash
npm install
npm run build
```

## Repository Layout

- `packages/`: framework packages and adapters
- `docs/`: architecture notes and standards
- `tests/`: integration and regression coverage
- `scripts/`: release and automation tasks

## Quality Standards

- TypeScript-first implementation
- Strict lint and type-check expectations
- Testability by design with explicit seams
- Consistent package metadata and release flow
