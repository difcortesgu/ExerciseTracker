# ADR-001: Architecture, tooling and enforcement

- **Status:** Accepted (finalised at the end of Sprint 0 after the design review).
- **Date:** 2026-11-12
- **Deciders:** architect (reviewed by the user at the sprint review)

## Context

The app has to stay easy to refactor and extend over 7 sprints, and the work is done by several
agents in parallel. `docs/ENGINEERING_STANDARDS.md` asks for a modular Clean Architecture, strict
TDD in every layer and rules that tooling enforces. This ADR records how Sprint 0 puts that in
place, and why.

## Decisions

### 1. Platform and dependencies

- **Expo SDK 58** (latest stable, React Native 0.88, React 19.3, TypeScript 6.0), `expo-router` 58.
  Only Expo Go modules are used. **No dependency needs a development build** (checked with
  `expo-doctor`, 20/20).
- Runtime dependencies are kept to the minimum: expo, expo-router (+ expo-constants, expo-linking,
  react-native-screens, react-native-safe-area-context), expo-splash-screen, expo-status-bar,
  expo-system-ui (needed for `userInterfaceStyle: automatic` on Android), expo-sqlite,
  expo-crypto (system `IdGenerator`), drizzle-orm.
- `react-dom` is pinned to the React version only because npm otherwise fails to resolve
  expo-router's *optional* web peers. It is never bundled for Android.
- The template's reanimated, gesture-handler, worklets and web packages were removed (YAGNI).
  The `reactCompiler` and `typedRoutes` experiments are off for now. The React Compiler's
  memoisation branches would distort presentation branch coverage, and typed routes need a
  generated `expo-env.d.ts` that a clean CI checkout doesn't have. Both can be revisited when there
  is real navigation (Sprint 2+).

### 2. Layers and the dependency rule

Every file under `src/`, `app/` and `test/` belongs to exactly one **element type**. Anything else
is a lint error (`boundaries/no-unknown-files`), so adding a new kind of folder is a decision for
the architect, not an accident.

| Element | Folder | May import (besides itself) |
|---|---|---|
| `shared-domain` | `src/shared/domain` | nothing |
| `shared-application` | `src/shared/application` | shared-domain |
| `shared-infrastructure` | `src/shared/infrastructure` | shared-domain, shared-application |
| `shared-ui` | `src/shared/ui` | nothing |
| `module-domain` | `src/modules/<m>/domain` | shared-domain, own domain |
| `module-application` | `src/modules/<m>/application` | shared-domain/application, own domain, other modules' `index.ts` |
| `module-infrastructure` | `src/modules/<m>/infrastructure` | shared-domain/application/infrastructure, own domain/application, other modules' `index.ts` |
| `module-presentation` | `src/modules/<m>/presentation` | shared-domain/application/ui, `core-presentation`, own domain/application, other modules' `index.ts` |
| `module` (public API) | `src/modules/<m>/index.ts` | own domain, application, presentation (**never infrastructure**) |
| `core-di` | `src/core/di` (composition root) | all shared layers, every module layer including infrastructure, module APIs, core-bootstrap |
| `core-bootstrap` | `src/core/bootstrap` | shared-domain/application, module APIs |
| `core-presentation` | `src/core/presentation` | shared-domain/application/ui, core-bootstrap, **types only** from core-di |
| `app` | `app/` (expo-router) | module APIs, core-presentation, core-di, shared-ui |
| `test-support` | `test/` | any `src` element |
| test files (`*.test.ts(x)`) | anywhere | their layer's rules **plus** test-support, core-di, core-presentation |

On top of that, `no-restricted-imports` forbids per layer:

- domain + application: React, React Native, `expo*`, `@expo/*`, Zustand, Drizzle, SQLite drivers, `node:*`;
- presentation (modules, shared/ui, core/presentation, app): SQLite/Drizzle and device-service
  packages (`expo-audio`, `expo-speech`, `expo-haptics`, `expo-notifications`, `expo-file-system`, …),
  which must sit behind ports;
- production adapters and wiring: `better-sqlite3` (Node-only test driver).

Reading the clock (`Date.now()`, `new Date()`, `Date()`, `performance.now()`) is forbidden in
domain, application and presentation; time comes from the `Clock` port. `console` is only allowed
in the logger adapter (`src/shared/infrastructure/logging/`).

**Cross-module domain concepts.** A module's domain may not import another module, not even
through its `index.ts`. Identifiers that several modules refer to (`ExerciseId`, `RoutineId`) live
in the shared kernel (`src/shared/domain`). How `workout` reads a routine tree for `flatten()` is
decided in Sprint 3 with its own ADR. The options are a routines use case that returns a
`Step[]`/DTO, or the workout application layer mapping the routines public DTO into workout's own
domain input.

### 3. Modules and public APIs

Modules: `exercises`, `routines`, `workout`, `history`, `stats`, `body`, `settings`, `backup`.
Each has `domain/`, `application/`, `infrastructure/`, `presentation/` and an `index.ts`.

- `index.ts` is the **only** entry point for other modules, `app/` and the composition root (except
  that the composition root imports infrastructure files directly).
- `index.ts` contains **re-exports only** (`export … from`); a `no-restricted-syntax` rule rejects
  anything else. This is what justifies excluding the barrels from coverage.
- Cycles between modules fail lint (`import/no-cycle`).

### 4. Composition root and dependency injection

- **Typed tokens** (`Token<T>`, `src/shared/application/di/token.ts`) are declared next to the port
  or use case they identify, in that module's application layer, and exported from its `index.ts`.
  Adding a module never edits a central token file (Open/Closed).
- **Container** (`src/core/di/container.ts`): `register(token, factory, { lifetime })` and
  `resolve(token)`. The default lifetime is a lazy singleton. Resolving a token that was never
  registered throws a programmer error that names the token.
- **Production wiring** (`src/core/di/composition-root.ts`): the only place where adapters are
  constructed (lint: nothing else may import infrastructure).
- **React binding** (`src/core/presentation/`): `DependencyProvider` + `useDependency(token)`.
  Screens get use cases through the hook. Screen tests render with a container full of fakes.
- Application and domain code never see the container (no service locator). Use cases receive their
  ports through factory/constructor parameters.
- `app/_layout.tsx` creates the production container once and wraps the tree in the provider and
  the bootstrap gate.

### 5. Path aliases

Defined once, in `tsconfig.json` `paths`: `@core/*`, `@shared/*`, `@modules/*`, `@test/*`,
`@assets/*`. They are read by tsc; by **Metro** (Expo's built-in tsconfig paths support); by
**Jest** (jest-expo derives `moduleNameMapper` from tsconfig); and by **ESLint**
(eslint-import-resolver-typescript). Proof: `test/toolchain/jest-toolchain.test.tsx` (Jest), and a
Sprint 0 Android bundle export that contained the aliased module (Metro). Inside a module, use
relative imports. Across layers or modules, use the alias, so every import shows which layer it
targets.

### 6. Boundary tooling

**ESLint only**: `eslint-plugin-boundaries` 7 (layers and modules), `no-restricted-imports`
(external packages), `import/no-cycle` (cycles), `boundaries/no-unknown-files`.

- Why not dependency-cruiser as well: one tool, one config, violations show in the editor, and
  every rule is proven by tests (below). The cost is `import/no-cycle`, which is the slowest rule.
  If `npm run lint` goes over 30 s, we add dependency-cruiser for cycles only.
- The ESLint config is built by a factory (`tooling/eslint/create-eslint-config.js`). The
  architecture lives as data in `tooling/eslint/boundary-policies.js`, and layer globs are shared
  with the coverage policy in `tooling/layers.js`.
- **Proof:** `tooling/eslint/boundaries.test.ts` and `code-quality.test.ts` lint virtual files at
  chosen paths of a fixture project (`tooling/eslint/__fixtures__/project`) with the real factory,
  and assert which rules fire (and which don't). There are 140+ cases, including domain →
  infrastructure, presentation → infrastructure, cross-module internals, cycles, `app/` →
  infrastructure, production → `test/`, adapters outside `src/core/di`, `any`, `@ts-ignore`, `!` in
  domain/application, focused/skipped tests, assertion-free tests, `Date.now()`, and undocumented
  `eslint-disable`.

### 7. TypeScript

`strict`, `noUncheckedIndexedAccess` (both required) plus:

- `exactOptionalPropertyTypes`: an absent target (`reps?`) is different from `reps: undefined`. This
  matters for drafts and set targets.
- `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`: cheap correctness
  checks.
- `isolatedModules` + `verbatimModuleSyntax`: Babel compiles one file at a time, and type-only
  imports must say `import type`, so type-only contract files never create runtime imports or
  cycles.

Unused locals and parameters are reported by ESLint, not tsc, so a red-phase test can still compile.
Proof: `tooling/typescript/strict.test.ts` compiles fixtures with the options parsed from the real
tsconfig.

### 8. Testing

- **Jest 30 + jest-expo 58**, two projects:
  - `app`: `src/`, `app/`, `test/`, with the React Native environment;
  - `tooling`: the tooling tests, in plain Node.
- **RNTL 14**: `render` is **async** (`await render(...)`). Built-in matchers load automatically.
  Query by accessibility label.
- **fast-check 4**: use `import * as fc from 'fast-check'`. `fc.assert` counts as an assertion
  for `jest/expect-expect`.
- **SQLite in Jest:** `better-sqlite3` 13 with `drizzle-orm/better-sqlite3`. The app uses
  `expo-sqlite` with `drizzle-orm/expo-sqlite`. Both are synchronous SQLite drivers that Drizzle
  types as `BaseSQLiteDatabase<'sync', …>`, so repositories are written once against that type and
  the same contract suite runs against a fresh `:memory:` database per test.
  - Rejected `node:sqlite`: there is no Drizzle driver for it in 0.45.
  - Rejected `sql.js`: async WASM loading, slower, and different driver semantics.
  - Rejected mocking expo-sqlite: the tests would not run real SQL.
  - `better-sqlite3` is a devDependency. Lint forbids it in production code; test databases are
    created in `test/` or `*.test.ts`.
- Test data builders go in `test/builders`, port fakes in `test/fakes`, contract suites in
  `test/contracts` (READMEs there describe the conventions).
- A contract suite has to **export** the function that registers its cases, because the test file
  of every implementation imports it. So `jest/no-export` is switched off for `test/contracts/**`
  only, in the lint config (`CONTRACT_SUITE_FILES`, proven in `code-quality.test.ts`). Ordinary test
  files still may not export, and contract files need no `eslint-disable` comments.
- **Mutation testing:** Stryker 10 (jest runner, TypeScript checker) on `src/**/domain/**`, run
  with `npm run test:mutation` (uses `jest.mutation.config.js`, the `app` project only). It is not
  part of `npm test`. Break threshold 80%.
- **E2E:** Maestro flows in `e2e/flows` (qa-engineer, S0-25).

### 9. Coverage thresholds

Defined in `tooling/jest/coverage-policy.js`. Thresholds can only go up:
`coverage-policy.test.ts` fails if a value drops below its floor.

| Scope (glob) | Lines | Branches | Functions | Statements |
|---|---|---|---|---|
| `src/{shared,modules/*}/domain/**` | 100 | 100 | 100 | 100 |
| `src/{shared,modules/*}/application/**` | 100 | 95 | 100 | 100 |
| `src/{shared,modules/*}/infrastructure/**` | 90 | 90 | 90 | 90 |
| `src/{modules/*/presentation,shared/ui}/**` | 85 | 85 | 85 | 85 |
| `src/core/**` | 90 | 90 | 90 | 90 |
| global (aggregate of all measured files) | 90 | 85 | 90 | 90 |

- **Core = 90%:** the container and bootstrap sequence are logic and are tested like application
  code. The composition root wires real adapters, and its test resolves every token with native
  modules mocked at the boundary, which is why it isn't held to 100%.
- **Per file:** Jest applies glob thresholds to *each matching file*, so the failure message names
  the file (e.g. `Coverage for branches (50%) does not meet ".../src/shared/domain/clamp.ts"
  threshold (100%)`).
- **Empty layers:** Jest fails with "coverage data … not found" when a glob matches no file. So
  `selectApplicableThresholds` (tested) keeps a layer's threshold only when at least one measured
  file exists, using the same micromatch semantics and the same patterns as `collectCoverageFrom`.
  A threshold switches on automatically with the first file of its layer and can't be forgotten.
  Type-only files count as 0/0 = 100%.
- **Proof:** `tooling/jest/coverage-enforcement.test.ts` runs Jest with the real coverage config on
  a fixture with an uncovered domain branch, and asserts a non-zero exit and the message above.
- **Exclusions** (each one justified in `tooling/jest/coverage-config.js`):
  - `*.test.ts(x)` files;
  - `*.d.ts` files;
  - module `index.ts` barrels (re-exports only, enforced by lint);
  - generated drizzle-kit migrations (`src/shared/infrastructure/db/migrations/**`).
  `app/` routes are thin wiring outside `src/` and are not measured; `test/` is test support.

### 10. Test-suite speed budget

- The whole `npm test -- --coverage` run must take **≤ 30 s** on a developer machine with a
  **warm Jest transform cache**, and the `app` project **≤ 10 s**. That is the everyday TDD loop.
- **End of Sprint 0 measurement** (8 cores, 54 suites / 480+ tests):

  | Run | Wall time |
  |---|---|
  | `npm test -- --coverage`, warm cache | **≈ 13 s** |
  | `app` project only, warm cache | ≈ 7.5 s |
  | `npm test -- --coverage`, cold cache (`--no-cache`, first run after `npm ci` or a Babel/Jest config change) | ≈ 55 s |

  The 45 s reported during Phase 2 was a cold-cache run. The cold run is dominated by Babel
  transforming `expo-router`/React Navigation once for `app-tabs.test.tsx` (about 39 s of that one
  suite's time when cold) and the ESLint rule tests loading the lint toolchain. That cost is paid
  once per cache and in CI, which has no Jest cache and a 20-minute job timeout. **The budget
  stays at 30 s (warm).** Cold runs are not budgeted but are watched: above 90 s, we look into
  narrowing jest-expo's `transformIgnorePatterns` or caching Jest's cache directory in CI.
- Any single test file that takes more than 2 s (warm, run alone) is a bug. Infrastructure tests
  use `:memory:` databases. Documented exceptions:
  - the tooling tests that spawn processes or load the whole lint/TypeScript toolchain (coverage
    enforcement, Prettier CLI, ESLint rule tests, TypeScript strictness);
  - `src/core/presentation/app-tabs.test.tsx`: the only navigation integration test (about 4 s
    alone, of which about 2.5 s is loading `expo-router`). Screen tests render screens directly
    and do not go through the router.
- The budget is reviewed at each sprint review.

### 11. Database migrations in Expo Go

- Each module owns its tables in `src/modules/<m>/infrastructure/**/*.schema.ts` (shared tables in
  `src/shared/infrastructure/db/**/*.schema.ts`). Modules never share tables.
- `npm run db:generate` (drizzle-kit, `dialect: sqlite`, `driver: expo`) writes versioned
  `NNNN_name.sql` files, `meta/_journal.json` and a `migrations.js` index to
  `src/shared/infrastructure/db/migrations/`.
- **Bundling:** `babel-plugin-inline-import` (in `babel.config.js`) turns `import sql from
  './0000_x.sql'` into a string literal, and Metro has `sql` in `resolver.sourceExts`
  (`metro.config.js`). Jest uses the same Babel config, so migrations load the same way in Expo Go
  and in tests. This was proven for Jest by `test/toolchain` and for Metro by a bundle export.
- The S0-19 runner (core-dev) consumes that generated index. It applies each pending migration in
  its own transaction, records the schema version in its own table, and returns a `Result`. It
  doesn't use drizzle's `useMigrations` hook, because the bootstrap sequence must stay a plain,
  testable function behind the `DatabaseMigrator` port.
- Never edit a migration that has shipped. The generated files are excluded from Prettier, lint and
  coverage.

### 12. Patterns used in Sprint 0 and why

| Pattern | Where | Problem it solves here |
|---|---|---|
| **Composite** | routine tree (`src/modules/routines/domain/routine.ts`: `Block` contains `Block \| ExerciseStep \| RestStep`) | circuits, supersets, EMOM and pyramids are nested repetitions of arbitrary depth; one recursive type expresses all of them, and drafts can be any shape |
| **Iterator** over the Composite | `locateNodes` in `validate-routine.ts` | validation needs every node with its path; one traversal feeds all per-node rules and the duplicate-id check, so the rules never walk the tree themselves. Sprint 3's flatten is the next traversal |
| **Result** | `src/shared/domain/result.ts`, every factory, the validator, migrator and bootstrapper | validation, migration and startup failures are expected. Returning them makes every caller handle them (the UI shows them) and keeps exceptions for programmer errors |
| **Value Object** + branded types | `Duration`, `Weight`, `Distance`, `Instant`, ids (`Brand`) | seconds vs milliseconds and kg vs lb mix-ups are impossible at compile time; values are validated once in their factory and stored at full precision (sprint decision 5) |
| **Factory** | `idFactory(name)` → `parse<IdType>`; `createToken`, `createContainer`, `createBootstrapper` | any module declares its own validated id type or token without editing shared code (Open/Closed); factories hide construction details from callers |
| **Repository + contract tests** | `test/contracts` harness (`defineContract`), proven with the test-only sample repository (fake + SQLite) | Sprint 1 use cases are tested with fast in-memory fakes, and the same suite proves fake and SQLite adapter behave identically (Liskov). Already used for the `Clock`, `IdGenerator` and `DatabaseMigrator` ports |
| **Dependency Injection / composition root** | `src/core/di` (typed `Token<T>`, lazy singletons) | one place decides which adapter backs each port; tests swap in fakes without touching production wiring; nothing native is opened before startup needs it |
| **Adapter** (ports & adapters) | `SystemClock`, `CryptoIdGenerator`, `ConsoleLogger`, `SqliteDatabaseMigrator`, `migrationsFromDrizzleKit` | keeps Expo, Node and Drizzle APIs out of domain and application, so they stay deterministic, portable and testable without native modules |
| **Builder** (test) | `test/builders` (`aRoutine().with(aBlock().repeat(3)…)`) + fast-check arbitraries | valid-by-default trees with deterministic ids; tests state only what matters and stay DRY |
| **MVVM** | screens + view-model hooks (`useBootstrap` + `AppBootstrapGate`) | screens only render; behaviour is tested through the hook and RNTL |

Patterns deliberately **not** used yet (YAGNI): State, Observer and Command (timer, Sprint 3, see
ADR-002), Strategy/Registry (step kinds, 1RM), Unit of Work (first multi-table write), Domain
Events (first cross-module flow). The single exhaustive `switch` over node kinds in
`validate-routine.ts` is the allowed "one switch inside the type's own module" (STANDARDS §2).

### 13. Decisions from the Sprint 0 implementation (design review)

- **Id factory naming:** `parseExerciseId`, `parseRoutineId`, `parseBlockId`, … instead of a value
  with the same name as the type. A same-name type + const is reported by
  `@typescript-eslint/no-redeclare`, and `parse` says what the function does: it turns raw input
  into a branded id or returns `shared.invalidId` ("parse, don't validate"). Convention for every
  module: `type XId = Id<'XId'>; const parseXId = idFactory('XId');`.
- **`SystemClock` never goes backwards:** the `Clock` port promises monotonic instants, and the
  wall clock can be moved back (manual change, network time). The adapter clamps to the latest
  instant it returned. Trade-off: after a backwards change, time stands still until it catches up
  (ADR-002 decision 1). The clamp is per process: code that compares instants across restarts
  (rebuilding a persisted session, ADR-002 decision 5) must tolerate a `now` earlier than a stored
  instant (elapsed time clamped at zero), and Sprint 4 tests that case.
- **Bootstrapper never rejects:** besides the migrator's `err`, an unexpected rejection becomes a
  logged `core.startupFailed`. The error type is the closed union
  `StartupError = MigrationError | DomainError<'core.startupFailed'>`, so the startup UI can map
  every code. `useBootstrap` still rethrows a rejection during render (to the nearest error
  boundary). It is unreachable with the real bootstrapper and makes a broken contract loud instead
  of an endless spinner.
- **Migrator, opening = first query:** a corrupt or unusable file only fails on its first query,
  so the version-table creation and the version read are part of "open" and return `db.openFailed`.
  `db.migrationFailed` always means that a specific migration failed and was rolled back.
- **Migrator, versions must be 1..n without gaps:** checked in the constructor and thrown as a
  programmer error, because a gap means a broken build artefact, not a user problem. The
  composition-root test constructs the real migrator, so a broken list fails CI.
- **Database newer than the app** (schema version above the highest known migration, e.g. after a
  sideloaded downgrade or switching branches in development): `ok` with nothing applied and the
  version unchanged (pinned by a test). Android does not downgrade store installs while keeping
  data, and backups are restored through use cases, not by copying the database file. Revisit (as
  a `db.schemaTooNew` startup error) if restoring a raw database file is ever added.
- **`SqliteDatabaseToken`** is declared in `shared/infrastructure/db`, not in an application
  port: the Drizzle database is an infrastructure detail that only the composition root and
  adapters see. Repositories receive it through the composition root.
- **Navigation shell:** the tab navigator (`AppTabs`) lives in `src/core/presentation` because it
  belongs to the app shell, not to a feature module. `app/` stays one-liner routes. The root layout
  renders `<Slot/>` inside the bootstrap gate, and the tabs are a `(tabs)` route group, so Sprint
  1+ can add stack screens (exercise detail, routine editor) outside the tabs without moving
  files. The root layout becomes a `Stack` when the first such screen arrives.
- **Tab bar: labels only in Sprint 0.** The acceptance criteria ask for labelled tabs, and icons
  are UX polish with no behaviour to test. Icons come in Sprint 1 (ui-dev) with
  `npx expo install @expo/vector-icons`, which works in Expo Go and needs no dev build.
- **`ErrorState` has no `alert` role:** on Android, a newly shown message is announced through
  `accessibilityLiveRegion`, not through the role, and the startup error replaces the whole screen
  anyway. When `ErrorState` is first
  used inline (Sprint 1), it gets an announcement (`accessibilityLiveRegion`) with a test.

## Consequences

- Breaking a boundary fails `npm run lint`, locally and in CI. New architecture (a new element type
  or a new allowed edge) changes `boundary-policies.js` and its tests, and is visible in review.
- New layers start with their thresholds switched on automatically. Nobody can quietly lower them.
- One extra dev-only native module (`better-sqlite3`) is needed. It ships prebuilt binaries for
  Node 24 on Linux, macOS and Windows.
- Open: cross-module domain access for `workout` (Sprint 3 ADR, options in ADR-002 decision 2).
