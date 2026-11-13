# test/ — shared test support (never shipped)

Production code under `src/` and `app/` must never import from here (enforced by lint).
Test files (`*.test.ts(x)`, next to the code they test) import with the `@test/*` alias.
Everything in this folder is excluded from production coverage.

| Folder | Contents |
|---|---|
| `fakes/` | In-memory / deterministic implementations of application ports |
| `builders/` | Test data builders (object mothers) for domain aggregates |
| `contracts/` | Reusable contract suites per port, run against the fake **and** the real adapter |
| `support/` | Shared test helpers (e.g. in-memory SQLite database factory, render-with-dependencies) |
| `toolchain/` | Smoke tests proving the Jest toolchain (RNTL, fast-check, aliases, inlined SQL) |
