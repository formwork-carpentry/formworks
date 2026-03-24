# Testing Mirroring Checklist

Use this checklist when adding or moving tests.

- Put domain tests under `tests/<domain>/...`.
- Keep each non-integration test focused on one Formworks domain.
- Import domain code via `@carpentry/formworks/<domain>` or `src/<domain>/...` only for that domain.
- If a test intentionally spans multiple domains, place it under `tests/integration/...`.
- Prefer local test doubles in the test file when an extra domain import is only for a helper/mock.

## CI Lint Command

Run:

```bash
pnpm run lint:test-mirroring
```

This command fails when a non-exempt test file does not mirror its target domain.
