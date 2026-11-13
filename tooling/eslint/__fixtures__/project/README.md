Minimal project tree used by the ESLint rule tests (`tooling/eslint/*.test.ts`). The files here are
only **import targets**: each test lints a virtual file at a chosen path inside this tree and asserts
which rules fire. `tsconfig.json` must keep the same `paths` as the root one (asserted by a test).
Ignored by the root lint, tsc, Jest and coverage.
