# Sprint 0 — Foundations

**Status:** implementation done, design review done (see "Design review"), QA done (see "QA report"); awaiting user review and the on-device checklist
**Source:** `PLAN.md` §5 "Sprint 0 — Foundations"; rules in `docs/ENGINEERING_STANDARDS.md`.

## Sprint goal

Have a running Expo Go app with 5 empty tabs, built on a Clean Architecture skeleton where the rules are enforced by tooling (TypeScript, lint and boundary rules, per-layer coverage thresholds). It also includes the shared kernel, the database foundation and the routine tree domain types that later sprints build on.

## Sprint demo criteria (from PLAN.md)

1. The app opens in Expo Go on an Android device with **5 empty tabs**: Workout, Routines, Exercises, Progress, Settings.
2. `npm test -- --coverage` is **green with the per-layer thresholds enforced**.

Also shown at the review (these come from the stories below):
- `npx tsc --noEmit` and `npm run lint` pass, and a deliberate boundary violation makes lint fail.
- The Stryker report for `domain` is shown and surviving mutants are listed.
- The Maestro smoke flow runs on Android.
- ADR-001 and ADR-002 are in `docs/adr/`.

## Conventions used in this file

- **Module** says where the story lives: `tooling`, `core`, `shared`, `routines`, `app` (expo-router routes) or `docs`.
- Each acceptance criterion (AC) is written as Given/When/Then so it can become an automated test or a check that can be repeated. ACs about tooling (lint, coverage) should be automated where practical, e.g. by running ESLint or Jest on fixture files inside the test suite, so the rules can't silently regress.
- Implementation choices (library versions, file names, exact config) belong to the architect unless an AC states them.

---

## Stories

### A. Project and tooling (architect first)

#### S0-01 — Expo + TypeScript project and git repository
**Module:** tooling
As a developer, I want a fresh Expo (latest SDK) + TypeScript project under git, so that all later work starts from a clean, versioned baseline.

- **Given** a fresh clone, **When** I run `npm install` and then `npx expo start`, **Then** the dev server starts without errors and shows a QR code that Expo Go on Android can open.
- **Given** the repository, **When** I run `git status` after a clean install, **Then** no generated artefacts appear as untracked (`node_modules`, `.expo`, coverage, Stryker reports and build output are git-ignored).
- **Given** `package.json`, **When** I list its scripts, **Then** at least `start`, `typecheck`, `lint`, `format`, `test`, `test:mutation` and `e2e` exist and are documented in the README.
- **Given** the project dependencies, **When** the architect reviews them, **Then** every native dependency is confirmed to work in Expo Go (none needs a dev build).

#### S0-02 — TypeScript strict mode
**Module:** tooling
As a developer, I want the compiler to reject unsafe code, so that type errors are caught before runtime.

- **Given** `tsconfig.json`, **When** it is inspected, **Then** `strict: true` and `noUncheckedIndexedAccess: true` are enabled.
- **Given** a source file that reads `array[0].name` without checking for `undefined`, **When** `npx tsc --noEmit` runs, **Then** it fails.
- **Given** the clean skeleton, **When** `npx tsc --noEmit` runs, **Then** it exits with code 0.

#### S0-03 — ESLint + Prettier with code-quality rules
**Module:** tooling
As a developer, I want lint and formatting rules that enforce the standards, so that forbidden shortcuts break the build.

- **Given** a file that uses `any`, **When** `npm run lint` runs, **Then** it fails.
- **Given** a file that contains `// @ts-ignore`, **When** `npm run lint` runs, **Then** it fails.
- **Given** a domain or application file that uses a non-null assertion (`!`), **When** `npm run lint` runs, **Then** it fails.
- **Given** a test that uses `.only`, `.skip`, `xit`, `xdescribe` or `fit`, **When** `npm run lint` runs, **Then** it fails.
- **Given** a domain, application or presentation file that calls `Date.now()` or `new Date()` directly, **When** `npm run lint` runs, **Then** it fails. (Time must come through the `Clock` port.)
- **Given** a badly formatted file, **When** `npm run format -- --check` (or the equivalent lint rule) runs, **Then** it reports the file. **Given** the clean skeleton, **Then** it reports nothing.
- **Given** the clean skeleton, **When** `npm run lint` runs, **Then** it exits with code 0.

#### S0-04 — Jest + React Native Testing Library + fast-check
**Module:** tooling
As a developer, I want a test runner that works for pure TS, React Native components and property-based tests, so that I can do TDD in every layer from the start.

- **Given** a pure TypeScript test, **When** `npm test` runs, **Then** it runs and reports its result.
- **Given** a component test written with RNTL that queries by accessibility label, **When** `npm test` runs, **Then** it renders the component and the assertion is evaluated.
- **Given** a `fast-check` property test, **When** `npm test` runs, **Then** the property runs and a failing property reports a shrunk counterexample.
- **Given** a test that uses a path alias (see S0-06), **When** `npm test` runs, **Then** the alias resolves the same way as in `tsc` and Metro.
- **Given** the full suite in Sprint 0, **When** `npm test` runs on a developer machine, **Then** it finishes in seconds. The architect sets a budget in ADR-001, and a slow suite counts as a bug.

#### S0-05 — Per-layer coverage thresholds
**Module:** tooling
As the team, I want coverage thresholds per layer that fail the build, so that TDD discipline can be checked.

- **Given** the Jest config, **When** it is inspected, **Then** it has a global threshold and these per-layer thresholds: `**/domain/**` 100% lines and branches; `**/application/**` 100% lines and ≥ 95% branches; `**/infrastructure/**` ≥ 90%; `**/presentation/**` and `shared/ui` ≥ 85%. The thresholds for `src/core` are set by the architect and recorded in ADR-001.
- **Given** a domain file with an uncovered branch, **When** `npm test -- --coverage` runs, **Then** it exits non-zero and names the domain threshold that failed.
- **Given** the clean skeleton, **When** `npm test -- --coverage` runs, **Then** it exits with code 0.
- **Given** any coverage exclusion (e.g. thin route files, generated migration SQL), **When** it is reviewed, **Then** it has a justification comment next to it and is listed in ADR-001.

#### S0-06 — Clean Architecture folder skeleton and path aliases
**Module:** core / shared / all modules
As a developer, I want the agreed folder structure and aliases in place, so that every file has a clear home and imports show which layer they target.

- **Given** the repository, **When** I list `src/`, **Then** it has `core/`, `shared/{domain,application,infrastructure,ui}` and `modules/{exercises,routines,workout,history,stats,body,settings,backup}`. Each module has `domain/`, `application/`, `infrastructure/`, `presentation/` and a public `index.ts`.
- **Given** the repository, **When** I list `test/`, **Then** `test/fakes/` and `test/builders/` exist, each with a short README describing the conventions (naming, one builder per aggregate, fakes must pass the port's contract suite).
- **Given** the path aliases defined by the architect, **When** the same import is used in app code, in a Jest test and in a Metro bundle, **Then** it resolves in all three.
- **Given** `test/fakes` and `test/builders`, **When** coverage is measured, **Then** they are excluded from production coverage.

#### S0-07 — Boundary enforcement
**Module:** tooling
As the architect, I want layer and module rules enforced by lint, so that the dependency rule can't be broken by accident.

Each AC below is checked against a fixture or a temporary file. They should be automated as tests where practical.
- **Given** a `domain` file that imports from `application`, `infrastructure` or `presentation`, **When** `npm run lint` runs, **Then** it fails with a boundaries error.
- **Given** a `domain` file that imports `react`, `react-native`, any `expo-*` package, `drizzle-orm` or `zustand`, **When** `npm run lint` runs, **Then** it fails.
- **Given** an `application` file that imports from `infrastructure`, `presentation`, React, Expo or Drizzle, **When** `npm run lint` runs, **Then** it fails.
- **Given** an `infrastructure` file that imports from `presentation`, **When** `npm run lint` runs, **Then** it fails.
- **Given** a `presentation` file that imports from any `infrastructure` folder, **When** `npm run lint` runs, **Then** it fails.
- **Given** a file in `src/core/di` (the composition root) that imports an infrastructure adapter, **When** `npm run lint` runs, **Then** it passes.
- **Given** a file in module A that imports a file inside module B other than B's `index.ts`, **When** `npm run lint` runs, **Then** it fails.
- **Given** two modules that import each other's `index.ts` (a cycle), **When** the boundary check runs, **Then** it fails.
- **Given** a route file in `app/` that imports from an `infrastructure` folder, **When** `npm run lint` runs, **Then** it fails.
- **Given** production code under `src/` or `app/` that imports from `test/`, **When** `npm run lint` runs, **Then** it fails.
- **Given** the clean skeleton, **When** `npm run lint` runs, **Then** the boundary check passes.

### B. Shared kernel (core-dev)

#### S0-08 — `Result` type
**Module:** shared/domain
As a developer, I want one explicit `Result<T, E>` type, so that expected failures are returned instead of thrown.

- **Given** a successful value, **When** `ok(value)` is created, **Then** it can be told apart from a failure by a type guard, and its value can be read only after narrowing.
- **Given** an error, **When** `err(error)` is created, **Then** it is a failure that carries that error.
- **Given** a success, **When** it is mapped or chained, **Then** the function is applied. **Given** a failure, **Then** the function is not called and the failure passes through unchanged.
- **Given** any `Result`, **When** it is created, **Then** it is immutable (trying to change it fails at compile time).
- **Given** the domain coverage threshold, **When** tests run, **Then** `Result` has 100% coverage, including property tests for the map/chain laws.

#### S0-09 — Base domain error
**Module:** shared/domain
As a developer, I want a common shape for domain errors, so that the UI can show them and tests can assert on them without matching strings.

- **Given** a domain error, **When** it is created, **Then** it has a stable machine-readable `code` and a human-readable message, and modules can define their own error codes without editing shared code.
- **Given** two errors with the same code and details, **When** they are compared in a test, **Then** they are structurally equal.

#### S0-10 — Branded IDs
**Module:** shared/domain
As a developer, I want branded ID types, so that an `ExerciseId` can never be passed where a `RoutineId` is expected.

- **Given** an `ExerciseId`, **When** it is passed to a function that expects a `RoutineId`, **Then** `npx tsc --noEmit` fails. This is proven by a compile-time type test, using an approach the architect chooses.
- **Given** a raw string, **When** an ID is created through its factory, **Then** an empty or whitespace-only string returns a failure `Result`, and a valid string returns the branded ID.
- **Given** the branding mechanism, **When** a module needs a new ID type, **Then** it can be declared in that module without editing `shared` (Open/Closed).

#### S0-11 — Weight value object
**Module:** shared/domain
As a lifter, I want weights stored correctly no matter whether I use kg or lb, so that my history stays correct when I change units.

- **Given** a non-negative finite number and a unit (`kg` or `lb`), **When** `Weight` is created, **Then** it succeeds.
- **Given** a negative number, `NaN` or `Infinity`, **When** `Weight` is created, **Then** it returns a failure `Result` with a specific error code.
- **Given** a weight in kg, **When** it is converted to lb and back, **Then** the value equals the original within a defined tolerance (property-based test).
- **Given** `100 kg` and its lb equivalent, **When** they are compared with value equality, **Then** they are equal.
- **Given** a `Weight`, **When** an operation is applied (e.g. conversion), **Then** a new instance is returned and the original is unchanged.

#### S0-12 — Duration value object
**Module:** shared/domain
As a developer, I want a `Duration` type, so that work and rest times are never mixed up between seconds and milliseconds.

- **Given** a non-negative finite number of seconds, **When** `Duration` is created, **Then** it succeeds. **Given** a negative number, `NaN` or `Infinity`, **Then** it returns a failure.
- **Given** two durations, **When** they are added, **Then** the result is a new `Duration` equal to the sum, and adding is associative and has a zero element (property-based test).
- **Given** a `Duration`, **When** it is read in seconds or milliseconds, **Then** both values are consistent.

#### S0-13 — Distance value object
**Module:** shared/domain
As a runner or rower, I want distances stored in a single canonical way, so that metres, kilometres and miles can all be compared.

- **Given** a non-negative finite number and a supported unit (`m`, `km`, `mi`, final list depends on open question Q5), **When** `Distance` is created, **Then** it succeeds. Invalid numbers return a failure.
- **Given** a distance, **When** it is converted between units and back, **Then** it equals the original within a defined tolerance (property-based test).
- **Given** `1 km` and `1000 m`, **When** they are compared with value equality, **Then** they are equal.

#### S0-14 — `Clock` and `IdGenerator` ports with system adapters and fakes
**Module:** shared/application, shared/infrastructure, test/fakes
As a developer, I want time and ID creation behind ports, so that domain and application code is deterministic in tests.

- **Given** the `Clock` port, **When** it is inspected, **Then** it lives in `shared/application`, has TSDoc and exposes the current instant without depending on any Expo or Node API.
- **Given** the `IdGenerator` port, **When** it is inspected, **Then** it lives in `shared/application` and has TSDoc.
- **Given** a `FakeClock` in `test/fakes` set to a fixed instant, **When** it is advanced by a `Duration`, **Then** `now()` returns the fixed instant plus that duration, and real time is never read.
- **Given** a deterministic fake `IdGenerator`, **When** it is called repeatedly, **Then** it returns a predictable, unique sequence.
- **Given** the system `Clock` adapter, **When** `now()` is called twice, **Then** the second value is not earlier than the first.
- **Given** the system `IdGenerator` adapter, **When** it is called many times, **Then** all IDs are unique and non-empty, and the adapter works in Expo Go.
- **Given** a fake and its real adapter, **When** the shared contract test for the port runs, **Then** both pass the same suite (Liskov).

### C. Composition root and bootstrap

#### S0-15 — DI container (composition root)
**Module:** core
As a developer, I want one typed composition root, so that adapters are wired to ports in exactly one place and tests can swap in fakes.

- **Given** a typed token for a port and a registered factory, **When** the token is resolved, **Then** the registered implementation is returned with the correct static type (no casts at the call site).
- **Given** a token that was never registered, **When** it is resolved, **Then** a programmer error is thrown whose message names the token.
- **Given** a container built for tests, **When** a port is registered with a fake, **Then** resolving it returns the fake and the production wiring is not touched.
- **Given** a registration with lazy, single-instance lifetime, **When** it is resolved twice, **Then** the factory runs once.
- **Given** the codebase, **When** it is searched, **Then** `src/core/di` is the only place where infrastructure adapters are constructed (enforced by S0-07).

#### S0-16 — React binding for the container
**Module:** core (presentation-facing binding)
As a UI developer, I want a provider and a hook to get use cases from the container, so that screens never create dependencies themselves.

- **Given** a component rendered inside the container provider, **When** it uses the hook with a token, **Then** it receives the registered implementation.
- **Given** a component rendered outside the provider, **When** it uses the hook, **Then** a clear programmer error is thrown.
- **Given** an RNTL test, **When** a screen is rendered with a test container full of fakes, **Then** it uses the fakes. This is the standard pattern for screen tests from now on.

#### S0-17 — App bootstrap
**Module:** core, app
As a user, I want the app to prepare its database before showing any screen, so that later features can rely on an up-to-date schema.

- **Given** a fresh install, **When** the app starts, **Then** it opens the SQLite database, runs pending migrations (S0-19) and then shows the tabs.
- **Given** a migration that fails at startup, **When** the app starts, **Then** it shows an error screen with a readable message instead of crashing or showing half-initialised tabs, and the error is logged.
- **Given** startup is in progress, **When** the user looks at the screen, **Then** a loading state is shown (no blank white screen).

### D. Persistence foundation (core-dev)

#### S0-18 — SQLite + Drizzle database client
**Module:** shared/infrastructure
As a developer, I want one way to get a typed Drizzle database, so that every repository uses the same connection setup.

- **Given** the app running in Expo Go, **When** the database client is created, **Then** it uses `expo-sqlite` through Drizzle.
- **Given** the Jest environment, **When** an infrastructure test needs a database, **Then** it gets a fresh, isolated in-memory SQLite database with the same Drizzle schema. No state leaks between tests.
- **Given** the client module, **When** it is inspected, **Then** only `shared/infrastructure`, module `infrastructure` folders and `core/di` can import it (enforced by S0-07).

#### S0-19 — Migration runner
**Module:** shared/infrastructure
As a user, I want my data to survive app updates, so that schema changes never lose my history.

- **Given** an empty database and a set of versioned migrations, **When** the runner runs, **Then** all migrations are applied in order and the current schema version is recorded.
- **Given** a database that is already up to date, **When** the runner runs again, **Then** nothing changes (idempotent).
- **Given** a database at version N and migrations up to N+2, **When** the runner runs, **Then** only N+1 and N+2 are applied.
- **Given** a migration that fails, **When** the runner runs, **Then** that migration is rolled back, the recorded version stays at the last successful migration, and a failure `Result` describing the error is returned.
- **Given** the migrations folder, **When** a new schema change is needed, **Then** it is added as a new migration file. How migrations are generated and bundled for Expo Go is documented by the architect.

#### S0-20 — Repository contract-test harness
**Module:** test (shared test support), shared/infrastructure
As a developer, I want a reusable contract suite per repository port, so that in-memory fakes and SQLite adapters are proven to behave the same.

- **Given** a contract suite written once for a port, **When** it is run with a factory for the in-memory fake and with a factory for the SQLite adapter, **Then** the same tests run against both and both pass.
- **Given** each contract test case, **When** it runs, **Then** it gets a fresh repository instance (fresh in-memory SQLite database for the real adapter).
- **Given** Sprint 0 has no real feature repository yet, **When** the harness is demonstrated, **Then** it is proven with a minimal test-only sample repository (fake + SQLite) kept under `test/`, not shipped in `src/`.
- **Given** the harness, **When** Sprint 1 adds `ExerciseRepository`, **Then** a contract suite can be added for it without changing the harness itself.

### E. Routine tree domain (core-dev)

#### S0-21 — Routine tree types (Composite)
**Module:** routines/domain
As a user building workouts, I want a routine to be a tree of blocks, exercises and rests, so that circuits, supersets, EMOM, Tabata and pyramids can all be expressed.

- **Given** the routine domain types, **When** they are inspected, **Then** they match the PLAN.md data model: `Routine { id, name, notes, root: Block }`; `Block { id, label, repeat, restBetweenRounds, children }`; `ExerciseStep { exerciseId, mode: 'timed' | 'reps', sets[] (each with target { reps?, weight?, duration?, distance? } and restAfter) }`; `RestStep { duration }`.
- **Given** a `Block`, **When** its children are typed, **Then** they are a discriminated union of `Block | ExerciseStep | RestStep` (Composite), so a block can contain blocks to any depth.
- **Given** the node union, **When** code switches on the discriminator, **Then** a missing case is a compile error (exhaustiveness check). The Composite pattern is named in TSDoc.
- **Given** any routine type, **When** code tries to change a field or push to `children`/`sets`, **Then** it fails at compile time (read-only types).
- **Given** targets for weight, duration and distance, **When** they are typed, **Then** they use the `Weight`, `Duration` and `Distance` value objects from the shared kernel, not raw numbers.
- **Given** `test/builders`, **When** a test needs a routine, **Then** a fluent builder (e.g. `aRoutine().withBlock(aBlock().repeat(3).with(anExerciseStep()...)).build()`) produces valid trees, and the routine tests use it instead of hand-written fixtures.

#### S0-22 — Routine tree validation
**Module:** routines/domain
As a user, I want invalid routines to be rejected with clear reasons, so that I can't save a routine the player can't run.

The rules below are proposed defaults. Q4 asks the user to confirm them.
- **Given** a valid routine, **When** it is validated, **Then** the result is a success that contains the routine.
- **Given** a block with `repeat` less than 1 or not a whole number, **When** it is validated, **Then** it fails with an error that identifies that block.
- **Given** a block (including the root) with no children, **When** it is validated, **Then** it fails.
- **Given** an `ExerciseStep` with no sets, **When** it is validated, **Then** it fails.
- **Given** a `timed` step where a set has no duration target or a zero duration, **When** it is validated, **Then** it fails.
- **Given** a `reps` step where a set has no reps target, **When** it is validated, **Then** it succeeds (meaning "until done, tap to finish"). **Given** a reps target that is present, it must be a whole number ≥ 1.
- **Given** a `RestStep` with a zero duration, **When** it is validated, **Then** it fails.
- **Given** a routine with an empty or whitespace-only name, **When** it is validated, **Then** it fails.
- **Given** a tree with duplicate node IDs, **When** it is validated, **Then** it fails.
- **Given** a routine with several problems in different nested blocks, **When** it is validated, **Then** the failure lists **every** problem, each with the path to the node that caused it (e.g. root → child 2 → child 0), so the editor in Sprint 2 can highlight them.
- **Given** random valid trees generated with `fast-check` (random depth and width), **When** they are validated, **Then** they always succeed. **Given** any one of them with a single rule broken at a random node, **Then** validation fails with exactly that path.
- **Out of scope:** checking that `exerciseId` refers to an existing exercise is a cross-module concern for a use case in Sprint 2.

### F. Presentation skeleton (ui-dev)

#### S0-23 — expo-router tab skeleton with 5 empty tabs
**Module:** app, modules/{workout,routines,exercises,stats,settings}/presentation, shared/ui
As a user, I want to see the app's 5 main sections, so that I know where features will appear.

- **Given** the app is launched in Expo Go on Android, **When** the tabs are shown, **Then** there are exactly 5 tabs in this order: Workout, Routines, Exercises, Progress, Settings.
- **Given** any tab, **When** it is selected, **Then** a placeholder screen with the tab's title and a short "coming soon" empty state is shown.
- **Given** each tab button and placeholder screen, **When** they are queried by accessibility label in an RNTL test, **Then** they can be found (labels match the tab names).
- **Given** each route file in `app/`, **When** it is inspected, **Then** it only renders a screen exported from the matching module's public `index.ts`, with no logic (thin route). The Progress tab is served by the `stats` module.
- **Given** the placeholder screens, **When** they are built, **Then** they use a minimal `Screen`/empty-state component and theme tokens from `shared/ui`, so screens never hard-code colours or spacing. Only what the placeholders need is built (YAGNI).
- **Given** the presentation tests, **When** `npm test -- --coverage` runs, **Then** presentation and `shared/ui` meet ≥ 85%.

### G. Quality tooling (qa-engineer)

#### S0-24 — Stryker mutation testing on domain
**Module:** tooling
As QA, I want mutation testing on the domain, so that tests are known to actually check behaviour, not only coverage.

- **Given** `npm run test:mutation`, **When** it runs, **Then** Stryker mutates only `src/**/domain/**` (shared and module domains) and produces an HTML and a text report.
- **Given** the Sprint 0 domain code (shared kernel and routine tree), **When** Stryker runs at the end of the sprint, **Then** the mutation score is ≥ 80% and surviving mutants are listed in the sprint review.
- **Given** the normal `npm test` run, **When** it runs, **Then** Stryker is not part of it, so the fast feedback loop stays fast.

#### S0-25 — Maestro smoke flow
**Module:** tooling (e2e)
As QA, I want an end-to-end smoke flow on Android, so that we know the app actually launches and navigates on a device.

- **Given** the app loaded in Expo Go on an Android device or emulator, **When** `npm run e2e` runs the smoke flow, **Then** the flow opens the app, checks each of the 5 tabs by visible label or accessibility label, and passes.
- **Given** the e2e folder, **When** it is inspected, **Then** a README explains the one-time setup (Maestro CLI, device/emulator, how to point the flow at Expo Go) and how to run it.

### H. Architecture decisions (architect)

#### S0-26 — ADR-001: Architecture
**Module:** docs
- **Given** `docs/adr/001-architecture.md`, **When** it is read, **Then** it records: the layering and dependency rule; the module list and public-API rule; the composition root/DI approach; the path aliases; the boundary tool(s) chosen and why; the coverage thresholds per layer including `core` and the justified exclusions; the test-suite speed budget; and how Drizzle migrations are bundled for Expo Go.
- **Given** the ADR, **When** it names patterns used in Sprint 0 (Composite, Result, Repository contract, DI), **Then** it says why each one solves a real problem here.

#### S0-27 — ADR-002: Timer strategy
**Module:** docs
- **Given** `docs/adr/002-timer-strategy.md`, **When** it is read, **Then** it records: the timestamp-based timer (time elapsed comes from the `Clock`, not from counting ticks); flattening the routine tree into a linear `Step[]` that the player walks; the planned state machine (State pattern) and cue subscribers (Observer); scheduling local notifications for every upcoming phase change when the app goes to the background and rebuilding state on return; the limits of Expo Go (no foreground service); and the conditions that would trigger moving to a development build.
- **Given** the ADR, **When** it is reviewed, **Then** it lists the risks to check in Sprint 4 (notification timing accuracy, Android battery optimisation, Doze).

#### S0-28 — GitHub Actions CI
**Module:** tooling (architect)
- **Given** a push or pull request to any branch, **When** GitHub Actions runs `.github/workflows/ci.yml`, **Then** it installs with `npm ci` (Node version pinned via `.nvmrc`, npm cache enabled) and runs `npx tsc --noEmit`, `npm run lint` (incl. boundary rules), `npm run format:check` and `npm test -- --coverage --ci`, failing the job if any step fails.
- **Given** the workflow, **When** it is read, **Then** it needs no secrets, and `npx expo-doctor` runs as a separate step.

---

## Work split

**Phase 1 — architect scaffolds first (blocking).** S0-01 to S0-07 (project, TS strict, ESLint/Prettier, Jest/RNTL/fast-check, coverage thresholds, folder skeleton and aliases, boundary rules), plus the first draft of S0-26. The architect also defines the **interfaces first**: the `Result`, `DomainError`, `Clock` and `IdGenerator` signatures, the DI token/container API, and the routine node type names, so that core-dev and ui-dev can work in parallel without waiting on each other.

**Phase 2 — core-dev and ui-dev in parallel, on files that don't overlap.**

| Story | Owner | Files owned (no overlap) |
|---|---|---|
| S0-08 Result | core-dev | `src/shared/domain/**` |
| S0-09 Domain error | core-dev | `src/shared/domain/**` |
| S0-10 Branded IDs | core-dev | `src/shared/domain/**` |
| S0-11 Weight | core-dev | `src/shared/domain/**` |
| S0-12 Duration | core-dev | `src/shared/domain/**` |
| S0-13 Distance | core-dev | `src/shared/domain/**` |
| S0-14 Clock / IdGenerator | core-dev | `src/shared/application/**`, `src/shared/infrastructure/**` (adapters), `test/fakes/**` |
| S0-15 DI container | core-dev | `src/core/di/` (container and production wiring) |
| S0-18 DB client | core-dev | `src/shared/infrastructure/db/**` |
| S0-19 Migration runner | core-dev | `src/shared/infrastructure/db/**`, migrations folder |
| S0-20 Contract harness | core-dev (reviewed by qa-engineer) | `test/contracts/**` (or as the architect names it) |
| S0-21 Routine tree types | core-dev | `src/modules/routines/domain/**`, `test/builders/**` |
| S0-22 Routine validation | core-dev | `src/modules/routines/domain/**` |
| S0-16 React container binding | ui-dev (once the S0-15 API is fixed by the architect) | a separate file/folder for the React binding, chosen by the architect, not the container file |
| S0-23 Tab skeleton | ui-dev | `app/**`, `src/modules/*/presentation/**`, the presentation exports in module `index.ts` files, `src/shared/ui/**` |
| S0-17 App bootstrap | ui-dev (loading/error UI) + core-dev (bootstrap sequence in `src/core/bootstrap`) | split by folder as shown |

**Phase 3 — qa-engineer.** S0-24 (Stryker) and S0-25 (Maestro) can start as soon as Phase 1 is done. After that, the qa-engineer verifies every AC above, runs `npx tsc --noEmit`, `npm run lint` and `npm test -- --coverage`, reports the real results, and lists surviving mutants.

**Architect closes** with S0-26/S0-27 finalised and a design review of all stories.

**Shared files to coordinate:** module `index.ts` files (core-dev adds domain/application exports, ui-dev adds presentation exports; the architect creates the files in Phase 1 so changes are small and additive) and `package.json` (dependencies are added only by the architect in Phase 1, or by request to the architect later).

---

## Out of scope for Sprint 0

- Any real feature screen, exercise seeding, routine editor or timer behaviour (Sprints 1 to 3).
- Tree traversal for flattening or duration estimates (Visitor/Iterator). This comes in Sprint 2/3 together with its first real use.
- Zustand stores. No UI state exists yet (YAGNI).
- CD (EAS Update/Build) - deferred until an Expo account exists.

---

## Definition of Done (every story, from `docs/ENGINEERING_STANDARDS.md` §6)

1. Meets all acceptance criteria in this file.
2. Respects the layer and module boundaries; `npm run lint` (including boundary rules) passes.
3. Developed with TDD (§4.1); `npx tsc --noEmit` and `npm test -- --coverage` pass with all per-layer coverage thresholds met.
4. No duplicated business logic; new extension points documented.
5. Architect design review done; significant decisions recorded as ADRs in `docs/adr/`.
6. Runs in Expo Go on Android.

In addition, each agent report includes TDD evidence: the tests written first, confirmed to have been seen failing before the implementation (§4.1).

---

## Decisions (answered by the user, 2026-11-12)

1. **Git / CI:** local git repository now; the user will create a GitHub repository. Quality gates run in **GitHub Actions CI** (story S0-28). CD (EAS Update / EAS Build) is deferred until an Expo account and `EXPO_TOKEN` secret exist (see BACKLOG).
2. **Device:** to be confirmed by the user at demo time (pin the latest stable Expo SDK supported by current Expo Go).
3. **CI:** yes, see S0-28. Maestro and Stryker stay local/manual.
4. **Routine validation:** repeat is a whole number >= 1 with no upper limit; nesting depth unlimited; a `reps` set may have no target ("until done"); every block, including the root, needs at least one child. **Drafts are allowed:** an incomplete routine can be saved; full validation is required before starting a workout. Validation must therefore be a pure function callable on any tree (it does not prevent construction of a draft tree).
5. **Units:** weight in kg and lb; distance in m, km and mi. Full precision stored, rounding only for display.
6. **Node ids:** every routine tree node (`Block`, `ExerciseStep`, `RestStep`) gets a branded id. PLAN.md updated.
7. **App identity:** display name `Exercise Tracker`, Android package `com.farid.exercisetracker`, Expo slug `exercise-tracker`. Placeholder icon.

---

## Interfaces (architect, Phase 1)

These contracts let core-dev and ui-dev work in parallel. **[stub]** means a type-only file already
exists. Extend it test-first; changing a signature needs the architect. **[doc]** means the signature
is only written here, and core-dev implements it test-first. Rationale for each decision:
`docs/adr/001-architecture.md`.

### Order of work (to avoid blocking)
1. core-dev starts with **S0-08 Result, S0-09 DomainError, S0-15 container + `createToken`**. They are
   small and they unblock ui-dev's S0-16/S0-17.
2. ui-dev starts with **S0-23** (tabs, `shared/ui`). Then S0-16 and S0-17 once `createToken`/`createContainer` land.
3. Everything else in the work split runs in parallel.

### Ownership refinements
- core-dev: `src/core/di/**`, `src/core/bootstrap/**`, the stub files below, and `test/support/` helpers for
  databases (e.g. `test/support/sqlite-test-database.ts`).
- ui-dev: `src/core/presentation/**` (React DI binding + startup UI), `app/**`, `src/shared/ui/**`, module
  `presentation/**`, and `test/support/render-with-dependencies.tsx` if needed.
- `app/` is empty on purpose: ui-dev writes `app/_layout.tsx` and the tab routes.

### Shared kernel: `src/shared/domain`
```ts
// result.ts [stub types: Ok<T>, Err<E>, Result<T, E = DomainError>]; add, all returning frozen objects:
export function ok<T>(value: T): Ok<T>;                       // ok(undefined) for Result<void, …>
export function err<E>(error: E): Err<E>;
export function isOk<T, E>(result: Result<T, E>): result is Ok<T>;
export function isErr<T, E>(result: Result<T, E>): result is Err<E>;
export function map<T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E>;
export function mapErr<T, E, F>(result: Result<T, E>, transform: (error: E) => F): Result<T, F>;
export function andThen<T, U, E, F>(result: Result<T, E>, next: (value: T) => Result<U, F>): Result<U, E | F>;
export function match<T, E, R>(result: Result<T, E>, handlers: { ok: (value: T) => R; err: (error: E) => R }): R;

// domain-error.ts [stub: interface DomainError<Code extends string = string> { code; message; details? }]; add:
export function domainError<Code extends string>(code: Code, message: string, details?: Readonly<Record<string, unknown>>): DomainError<Code>;
// Codes: `<module>.<camelCaseReason>`; modules declare their own literal unions.

// brand.ts [doc]
declare const brand: unique symbol;
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };

// id.ts [doc]: Open/Closed, any module declares its own id without editing shared
export type Id<Name extends string> = Brand<string, Name>;
export type InvalidIdError = DomainError<'shared.invalidId'>;       // empty / whitespace-only
export function idFactory<Name extends string>(name: Name): (raw: string) => Result<Id<Name>, InvalidIdError>;

// ids.ts [doc]: identifiers referenced by several modules (module domains may not import each other)
// Factories are named parse<IdType> (design review, ADR-001 §13): a same-name type + const fails
// @typescript-eslint/no-redeclare. Convention: `type XId = Id<'XId'>; const parseXId = idFactory('XId');`
export type ExerciseId = Id<'ExerciseId'>;  export const parseExerciseId = idFactory('ExerciseId');
export type RoutineId = Id<'RoutineId'>;    export const parseRoutineId = idFactory('RoutineId');

// assert-never.ts [doc]: exhaustiveness helper for switches on discriminated unions
export function assertNever(value: never): never;               // throws (programmer error)

// Value objects [doc]: immutable, created only through factories returning Result,
// canonical unit stored at full precision, conversions return numbers or new instances.
// duration.ts:  canonical milliseconds. durationFromSeconds(s), durationFromMilliseconds(ms)
//               -> Result<Duration, DomainError<'shared.invalidDuration'>>; ZERO_DURATION;
//               addDurations(a, b); toSeconds(d); toMilliseconds(d); durationEquals(a, b)
// weight.ts:    WeightUnit = 'kg' | 'lb'; canonical kilograms; KILOGRAMS_PER_POUND = 0.45359237;
//               createWeight(value, unit) -> Result<Weight, DomainError<'shared.invalidWeight'>>;
//               weightIn(weight, unit): number; weightEquals(a, b) (named tolerance constant)
// distance.ts:  DistanceUnit = 'm' | 'km' | 'mi'; canonical metres; METRES_PER_MILE = 1609.344;
//               createDistance(value, unit) -> Result<Distance, DomainError<'shared.invalidDistance'>>;
//               distanceIn(distance, unit): number; distanceEquals(a, b)
// instant.ts:   Instant = Brand<number, 'Instant'> (UTC epoch milliseconds);
//               instantFromEpochMilliseconds(ms) -> Result<Instant, DomainError<'shared.invalidInstant'>>;
//               addDuration(instant, duration): Instant
```
Compile-time type tests (e.g. "an `ExerciseId` is not a `RoutineId`") use
`// @ts-expect-error -- <reason>` in `*.test.ts`. `npx tsc --noEmit` type-checks test files, so an
expected error that doesn't happen fails the typecheck. Lint allows `@ts-expect-error` only when it has a
description.

### Ports: `src/shared/application` [doc] (each with TSDoc and a `Token`)
```ts
// clock.ts
export interface Clock { now(): Instant }                          // ClockToken
// id-generator.ts
export interface IdGenerator { next(): string }                    // non-empty, unique; IdGeneratorToken
// logger.ts
export type LogContext = Readonly<Record<string, unknown>>;
export interface Logger {                                          // LoggerToken
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
// database-migrator.ts
export interface MigrationReport { readonly fromVersion: number; readonly toVersion: number; readonly applied: readonly string[] }
export type MigrationError = DomainError<'db.openFailed' | 'db.migrationFailed'>;
export interface DatabaseMigrator { migrate(): Promise<Result<MigrationReport, MigrationError>> }   // DatabaseMigratorToken
```
Adapters go in `src/shared/infrastructure`: `SystemClock` (the only `Date.now()`), `CryptoIdGenerator`
(`expo-crypto` `randomUUID`, works in Expo Go), `ConsoleLogger` (`logging/`, the only place where
`console` is allowed), and the S0-19 migrator (`db/`). Fakes go in `test/fakes`: `FakeClock` (fixed start,
`advanceBy(duration)`), `SequentialIdGenerator`, `RecordingLogger`. Contract suites go in `test/contracts`:
`clock.contract.ts`, `id-generator.contract.ts`, `logger` if it ever has behaviour worth a contract.

### Dependency injection
```ts
// src/shared/application/di/token.ts [stub: interface Token<T> { key: symbol; description: string }]; add:
export function createToken<T>(description: string): Token<T>;    // description: '<module>.<Name>'
// Constants are named `<Name>Token`, declared next to the port/use case, and exported from the module index.

// src/core/di/container.ts [stub: Lifetime, RegistrationOptions, Factory<T>, Resolver, Container]; add:
export function createContainer(): Container;                      // default lifetime: lazy singleton
// src/core/di/composition-root.ts [doc]
export function createProductionContainer(): Container;            // the ONLY place adapters are constructed
```
`resolve` on a token that was never registered throws `Error` whose message contains `token.description`.

### React binding (ui-dev, S0-16): `src/core/presentation/` [doc]
```ts
export function DependencyProvider(props: { readonly resolver: Resolver; readonly children: ReactNode }): ReactElement;
export function useDependency<T>(token: Token<T>): T;  // outside the provider: throws Error naming DependencyProvider
```
core/presentation may import **types only** from `@core/di` (lint-enforced). Standard screen-test pattern:
build a `createContainer()`, register fakes, then `await render(<DependencyProvider resolver={container}>…)`.
RNTL 14's `render` is async.

### Bootstrap contract (S0-17)
```ts
// src/core/bootstrap/bootstrapper.ts [stub type]; core-dev adds:
export type StartupError = MigrationError | DomainError<'core.startupFailed'>;   // closed union (design review)
export type Bootstrapper = () => Promise<Result<void, StartupError>>;  // never rejects: a rejection becomes core.startupFailed
export function createBootstrapper(deps: { readonly migrator: DatabaseMigrator; readonly logger: Logger }): Bootstrapper;
export const BootstrapperToken: Token<Bootstrapper>;                // registered by the composition root
// The bootstrapper logs failures through Logger before returning err(...).

// src/core/presentation/ (ui-dev) [doc]
export type BootstrapState =
  | { readonly status: 'running' }
  | { readonly status: 'ready' }
  | { readonly status: 'failed'; readonly error: DomainError };
export function useBootstrap(bootstrap: Bootstrapper): BootstrapState;   // view-model hook, runs once per mount
export function AppBootstrapGate(props: { readonly children: ReactNode }): ReactElement;
// resolves BootstrapperToken with useDependency; renders a loading state (accessibility label
// "Loading Exercise Tracker"), an error screen (label "Startup failed" + error.message), or children.

// app/_layout.tsx (ui-dev): thin wiring only
//   const container = createProductionContainer();
//   <DependencyProvider resolver={container}><AppBootstrapGate><Slot/></AppBootstrapGate></DependencyProvider>
// app/(tabs)/_layout.tsx re-exports AppTabs (src/core/presentation/app-tabs.tsx, the tab navigator);
// app/(tabs)/<tab>.tsx re-export the module screens (design review, ADR-001 §13).
```

### Routine tree (S0-21/S0-22): `src/modules/routines/domain/` [doc]
```ts
export type BlockId = Id<'BlockId'>;  export type ExerciseStepId = Id<'ExerciseStepId'>;  export type RestStepId = Id<'RestStepId'>;
export const parseBlockId = idFactory('BlockId');  export const parseExerciseStepId = idFactory('ExerciseStepId');  export const parseRestStepId = idFactory('RestStepId');
export type ExerciseMode = 'timed' | 'reps';
export interface SetTarget { readonly reps?: number; readonly weight?: Weight; readonly duration?: Duration; readonly distance?: Distance }
export interface ExerciseSet { readonly target: SetTarget; readonly restAfter: Duration }
export interface Block        { readonly kind: 'block';    readonly id: BlockId;        readonly label: string; readonly repeat: number;
                                readonly restBetweenRounds: Duration; readonly children: readonly RoutineNode[] }
export interface ExerciseStep { readonly kind: 'exercise'; readonly id: ExerciseStepId; readonly exerciseId: ExerciseId;
                                readonly mode: ExerciseMode; readonly sets: readonly ExerciseSet[] }
export interface RestStep     { readonly kind: 'rest';     readonly id: RestStepId;     readonly duration: Duration }
/** Composite pattern: a Block contains nodes of any kind to any depth. */
export type RoutineNode = Block | ExerciseStep | RestStep;
export interface Routine { readonly id: RoutineId; readonly name: string; readonly notes: string; readonly root: Block }

// Validation: pure, callable on any (draft) tree; construction never validates.
export type NodePath = readonly number[];                          // child indexes from the root; [] = root
export type RoutineValidationCode =
  | 'routines.emptyName' | 'routines.invalidRepeat' | 'routines.emptyBlock' | 'routines.noSets'
  | 'routines.missingDuration' | 'routines.invalidReps' | 'routines.zeroRest' | 'routines.duplicateNodeId';
export interface RoutineValidationIssue extends DomainError<RoutineValidationCode> { readonly path: NodePath }
export interface RoutineValidationError extends DomainError<'routines.invalidRoutine'> { readonly issues: readonly RoutineValidationIssue[] }
export type ValidatedRoutine = Brand<Routine, 'ValidatedRoutine'>;   // the player (Sprint 3) only accepts this
export function validateRoutine(routine: Routine): Result<ValidatedRoutine, RoutineValidationError>;
```
Builders go in `test/builders/` (`aRoutine()`, `aBlock()`, `anExerciseStep()`, `aRestStep()`, `aSet()`). Ids come
from a deterministic sequence.

---

## Design review (architect, end of Sprint 0)

Scope: all code in `src/`, `app/` and `test/`, checked against `docs/ENGINEERING_STANDARDS.md`
(layering, module boundaries, typing, naming, duplication, size, pattern naming, test quality, magic
values). Decisions are recorded in ADR-001 §8, §10, §12 and §13, and in ADR-002 (S0-27).

**Outcome: accepted.** No layer or module-boundary violations, no business logic in UI or
infrastructure, every Expo/DB API sits behind a port or in the composition root, all files are
≤ 250 lines (one tooling test file excepted, see below), and the tests are behaviour-named with
meaningful assertions, with no signs of test-after.

### Accepted decisions (flagged by the devs)

| Item | Decision |
|---|---|
| `parse<IdType>` id factories (core-dev) | accepted; Interfaces section and ADR-001 §13 updated |
| `SystemClock` monotonic clamp (core-dev) | accepted; trade-off in ADR-001 §13 and ADR-002 decision 1 |
| Bootstrapper turns rejections into `core.startupFailed` (core-dev) | accepted, and its error type narrowed to `StartupError` (below) |
| Migrator: `db.openFailed` on first-query failure; versions must be 1..n; newer database = no-op `ok` (core-dev) | accepted; ADR-001 §13. The newer-database behaviour was untested and is now pinned by a test |
| Tab navigator in `src/core/presentation`, `(tabs)` group + `<Slot/>` (ui-dev) | accepted; ADR-001 §13 |
| Labels-only tab bar (ui-dev) | accepted for Sprint 0; icons with `@expo/vector-icons` (Expo Go-compatible) in Sprint 1, ui-dev |
| `useBootstrap` rethrows rejections (ui-dev) | accepted (unreachable with the real bootstrapper; makes contract breaks loud) |
| `ErrorState` without `alert` role (ui-dev) | accepted for Sprint 0; live-region announcement when first used inline (open item) |
| Value-object factories in `duration.ts`/`weight.ts`/`distance.ts` follow the same shape | accepted: the shared rules are already in `numbers.ts`; a generic branded constructor would need casts |
| Five near-identical placeholder screens and screen tests | accepted: temporary, each is replaced by its feature sprint |

### Fixed in the review

- **`jest/no-export` in contract suites:** switched off for `test/contracts/**` in
  `tooling/eslint/create-eslint-config.js` (`CONTRACT_SUITE_FILES` in `tooling/eslint/layers.js`).
  Written test-first: 3 cases in `tooling/eslint/code-quality.test.ts`, seen failing with
  `jest/no-export` before the config change. The 5 file-level `eslint-disable`/`eslint-enable`
  comments were removed, and `test/contracts/README.md` documents the rule.
- **`StartupError`:** `src/core/bootstrap/bootstrapper.ts` now returns the closed union
  `MigrationError | DomainError<'core.startupFailed'>` instead of an open `DomainError`
  (test-first: a compile-time test in `bootstrapper.test.ts` failed `tsc` before the change).
  `use-bootstrap.test.tsx` uses the new type.
- **`use-bootstrap.test.tsx`:** removed the `null as Error | null` cast (typed boundary state
  instead), and the `console.error` spy is now restored in `afterEach`, so a failing assertion
  can't leak it.
- **Migrator characterization test:** "leaves a database written by a newer app version
  untouched" in `sqlite-database-migrator.test.ts`. It passed straight away, because it pins
  existing behaviour that had not been tested.
- **Test speed** measured and ADR-001 §10 updated (warm ≈ 13 s; cold ≈ 55 s explained; budget kept).

### Open items

| # | Where | Issue | Suggested fix | Owner | When |
|---|---|---|---|---|---|
| 1 | `app/_layout.tsx` | no root error boundary: a render-time programmer error (e.g. the `useBootstrap` rethrow, a missing DI registration) shows a blank or red screen | `export function ErrorBoundary` (expo-router) that renders `ErrorState` inside `Screen`, test-first with a throwing child | ui-dev | Sprint 1 |
| 2 | `src/core/presentation/use-bootstrap.ts:10` | `failed.error` is typed as the open `DomainError` | type it as `StartupError` so the gate can map codes to messages exhaustively | ui-dev | Sprint 1 |
| 3 | `src/shared/ui/heading.tsx:17`, `src/core/presentation/app-tabs.tsx:30` | `fontWeight: 'bold'` hard-coded twice (not a token) | add a `typography` weight token, use it in both | ui-dev | Sprint 1 |
| 4 | `src/shared/ui/error-state.tsx:20` | the error is not announced when it appears | `accessibilityLiveRegion="polite"` when `ErrorState` is first used inline, with a test | ui-dev | Sprint 1 |
| 5 | `src/core/presentation/app-tabs.tsx:10` | tab bar has labels only | icons via `npx expo install @expo/vector-icons` (works in Expo Go), test-first | ui-dev | Sprint 1 |
| 6 | `src/modules/routines/domain/routine.test.ts:91` | "lets a block be typed with the Block interface" only echoes a field the builder set, so it proves nothing beyond the other tests | delete it, or turn it into a real compile-time check | core-dev | Sprint 1 |
| 7 | `src/shared/infrastructure/db/sqlite-database-migrator.ts:80` | `currentVersion(database)` inside the `catch` can throw and reject `migrate()`, which the port forbids (the bootstrapper contains it as `core.startupFailed`) | read `reachedVersion` defensively (fall back to the last applied version you counted) | core-dev | Sprint 1 |
| 8 | `tooling/eslint/boundaries.test.ts` | 349 lines, over the 250-line guideline | split by concern (layers, modules, app/test, adapters) | architect | Sprint 1 |

---

## QA report (qa-engineer, end of Sprint 0)

Date: 2026-11-12. Environment: Linux, Node 24.14.1, 8 cores. **No Android device or emulator was
attached and Maestro is not installed on this machine**, so everything marked "device" below still
needs the manual checklist at the end of this section. Nothing was committed.

Design-review open items 1, 2, 3, 6 and 7 were re-checked and are fixed (root `ErrorBoundary` in
`app/_layout.tsx:8`; `BootstrapState.failed.error: StartupError` in
`src/core/presentation/use-bootstrap.ts:9`; `typography.strongWeight` token used by `heading.tsx`
and `app-tabs.tsx`; the echo test is gone from `routine.test.ts`; the migrator counts
`reachedVersion` instead of re-reading it, `sqlite-database-migrator.ts:79-90`). Items 4, 5 and 8
are in BACKLOG "Carry-over from Sprint 0".

### Quality gates (real output)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 (6.3 s) |
| `npm run lint` | exit 0, 0 warnings (25 s) |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm test -- --coverage` | exit 0. **56 suites, 493 tests passed**, 0 snapshots, 12.3 s (warm). Coverage: statements 100% (256/256), branches 100% (101/101), functions 100% (120/120), lines 100% (251/251); every per-layer threshold met |
| `npx expo-doctor` | "20/20 checks passed. No issues detected!" exit 0 |
| `npx expo export --platform android --output-dir <scratchpad>/export-qa` | exit 0, 18.6 s. 1 Hermes bundle `entry-….hbc` (2.9 MB), 26 assets, `metadata.json` |
| `npm run test:mutation` (Stryker) | see S0-24 below |
| Boundary violation demo | a temporary `src/modules/routines/domain/qa-violation.ts` importing shared infrastructure, `react` and another module's presentation, with `any` and `Date.now()`, failed `eslint` with 5 errors (`boundaries/dependencies` ×2, `no-restricted-imports`, `@typescript-eslint/no-explicit-any`, `no-restricted-properties`), exit 1. File deleted afterwards |

Final run after the QA test additions below: `tsc` exit 0, `lint` exit 0, `format:check` clean,
`npm test -- --coverage` exit 0 with **56 suites, 496 tests** (3 new), coverage still 100% on all four
metrics, 12.8 s.

### S0-24 Stryker mutation testing

Setup completed: `stryker.config.json` mutates only `src/shared/domain/**/*.ts` and
`src/modules/*/domain/**/*.ts` (tests excluded), runs Jest through `jest.mutation.config.js` (the
`app` project only) with the TypeScript checker, break threshold 80. Reporters: clear-text (text
report with the score table and every surviving mutant, printed to the terminal), HTML
(`reports/mutation/index.html`) and, added by QA, JSON (`reports/mutation/mutation.json`). `npm test`
does not run Stryker (separate Jest config and script). README "Mutation testing" documents it.

| Run | Score | Killed | Survived | No coverage | Timeout | Errors (not scored) | Time |
|---|---|---|---|---|---|---|---|
| 1, before QA tests | **87.18%** (break 80 met, exit 0) | 102 | **15** | 0 | 0 | 133 | 3 min 37 s |
| 2, after QA tests | **100.00%** (exit 0) | 117 | 0 | 0 | 0 | 133 (130 CompileError, 3 RuntimeError) | 3 min 38 s |

Per file in run 1: `validate-routine.ts` 86.36%, `distance.ts`/`instant.ts`/`weight.ts` 75%,
`duration.ts` 83.33%, `id.ts` 85.71%, `numbers.ts` 94.74%, `result.ts`/`domain-error.ts`/
`describe-cause.ts`/`assert-never.ts` 100%; `routine.ts` and `ids.ts` have no scorable mutants
(type-only plus `idFactory` calls). In run 2 every file is at 100%.

Surviving mutants in run 1 (all now killed, see "Tests added by QA"):

| # | File:line | Mutator | Mutation | Why it survived |
|---|---|---|---|---|
| 1-8 | `src/modules/routines/domain/validate-routine.ts:33`, `:34`, `:35`, `:36`, `:37`, `:38`, `:39`, `:40` | StringLiteral | each entry of `MESSAGES` (`routines.emptyName`, `invalidRepeat`, `emptyBlock`, `noSets`, `missingDuration`, `invalidReps`, `zeroRest`, `duplicateNodeId`) → `""` | tests asserted only `message: expect.any(String)`, which `""` passes |
| 9 | `src/modules/routines/domain/validate-routine.ts:153` | StringLiteral | summary message → empty template literal | as above |
| 10 | `src/shared/domain/distance.ts:40` | StringLiteral | error message → `""` | rejection tests checked code and details only |
| 11 | `src/shared/domain/duration.ts:28` | StringLiteral | error message → `""` | as above |
| 12 | `src/shared/domain/id.ts:20` | StringLiteral | `${name} must not be empty.` → empty template literal | as above |
| 13 | `src/shared/domain/instant.ts:23` | StringLiteral | error message → `""` | as above |
| 14 | `src/shared/domain/weight.ts:34` | StringLiteral | error message → `""` | as above |
| 15 | `src/shared/domain/numbers.ts:22` | EqualityOperator | `<= RELATIVE_EQUALITY_TOLERANCE * scale` → `<` | no test at exactly the tolerance |

The 3 RuntimeError mutants (`numbers.ts:13`: `value >= 0` → `value > 0`, `value < 0`, `false`) make
`ZERO_DURATION` throw at module load, so every test that imports `duration.ts` fails; they are
detected, Stryker just doesn't score them. The 130 CompileErrors are mutants the TypeScript checker
rejects (e.g. in `result.ts`, where most mutations break the types).

### S0-25 Maestro smoke flow

- `e2e/flows/smoke-tabs.yaml` (appId `host.exp.exponent`): launches Expo Go, opens
  `EXPO_URL` (default `exp://127.0.0.1:8081`, override with `npm run e2e -- -e EXPO_URL=…`),
  dismisses Expo Go's first-run "Continue" introduction if shown, waits up to 120 s for
  `Workout screen`, asserts `Startup failed` is not visible, then taps Routines, Exercises, Progress,
  Settings and Workout, asserting each `"<Tab> screen"` label and the "Coming soon" empty state.
- `npm run e2e` = `maestro test e2e/flows` (unchanged; it runs every flow in the folder).
- `e2e/README.md`: one-time setup (Java, Maestro CLI, adb, device/emulator, Expo Go), how to run it
  over USB/emulator (`adb reverse tcp:8081 tcp:8081`) or Wi-Fi, troubleshooting, conventions.
  Root README has a short "End-to-end smoke test" section.
- **Validation without a device:** parsed with PyYAML (2 documents: header with `appId`, `name`,
  `tags`, `env`; 22 commands, all known Maestro commands; each of the 5 `"<Tab> screen"` labels
  asserted; taps Routines → Exercises → Progress → Settings → Workout); Prettier-clean.
  **The flow has not been executed** (`maestro --version`: command not found; no device). The
  selectors match what the RNTL tests query, but whether Android's UI hierarchy exposes the
  `SafeAreaView` content description `"<Tab> screen"` to Maestro is unverified. If it does not,
  the fallback is a `testID` on `Screen` (ui-dev).

### Acceptance criteria

Legend: **pass** = verified by an automated test or a command run in this QA pass; **device** =
automated evidence passes but the AC is about the running app and needs the manual checklist;
**fail** = not met.

| Story | Result | Evidence |
|---|---|---|
| S0-01 Project + git | pass, device | `npm start`/QR on device: device. `.gitignore` covers `node_modules/`, `.expo/`, `coverage/`, `reports/`, `.stryker-tmp/`, `dist/` (`git check-ignore -v`). Scripts start/typecheck/lint/format/test/test:mutation/e2e exist and are in README. Expo Go compatibility: expo-doctor 20/20, ADR-001 §1, Android export succeeds. Note: the repository has **no commit yet** (`git log`: "does not have any commits yet"), see bug Q-4 |
| S0-02 TS strict | pass | `tooling/typescript/strict.test.ts` (strict + noUncheckedIndexedAccess; rejects `array[0].name`); `npx tsc --noEmit` exit 0 |
| S0-03 ESLint/Prettier rules | pass | `tooling/eslint/code-quality.test.ts` (any, @ts-ignore, `!` in domain/application, .only/.skip/xit/xdescribe/fit, Date.now/new Date per layer, unjustified eslint-disable); `tooling/prettier/format.test.ts`; lint and format:check exit 0 |
| S0-04 Jest/RNTL/fast-check | pass | `test/toolchain/jest-toolchain.test.tsx` (pure TS, RNTL by label, fast-check, shrunk counterexample, aliases, .sql inlining); suite 12.3 s warm (budget 30 s, ADR-001 §10) |
| S0-05 Per-layer coverage | pass | `tooling/jest/coverage-policy.js` + `coverage-policy.test.ts` (floors can't drop); `coverage-enforcement.test.ts` (uncovered domain branch → non-zero exit naming the file and threshold); exclusions justified in `coverage-config.js` and ADR-001 §9; `npm test -- --coverage` exit 0 |
| S0-06 Skeleton + aliases | pass | all 8 modules × 4 layers + `index.ts`; `test/fakes/README.md`, `test/builders/README.md`; aliases proven in Jest (`jest-toolchain.test.tsx`), tsc, ESLint (`boundaries.test.ts` "uses the same path aliases") and Metro (Android export bundles `@core/*`/`@modules/*` imports from `app/`); `test/` not in `collectCoverageFrom` |
| S0-07 Boundary enforcement | pass | `tooling/eslint/boundaries.test.ts` (layer rule, framework imports, composition root, module internals, cycles, app → infrastructure, production → test/, unknown files); live violation demo above |
| S0-08 Result | pass | `result.test.ts` (guards, narrowing via @ts-expect-error, frozen + compile-time read-only, map/andThen laws as properties); 100% coverage; Stryker 100% on `result.ts` |
| S0-09 Domain error | pass | `domain-error.test.ts` (code + message, module-owned codes, structural equality, frozen); QA strengthened "readable message" checks (below) |
| S0-10 Branded ids | pass | `id.test.ts` (ExerciseId ≠ RoutineId via @ts-expect-error, blank → `shared.invalidId`, module-declared `SampleId`) |
| S0-11 Weight | pass | `weight.test.ts` (valid/invalid incl. NaN/±Infinity, kg↔lb round-trip property, 100 kg = lb equivalent, frozen/new instances). See bug Q-1 (-0) |
| S0-12 Duration | pass | `duration.test.ts` (valid/invalid, sum, associativity + zero element properties, seconds/ms consistency) |
| S0-13 Distance | pass | `distance.test.ts` (m/km/mi, round-trip property, 1 km = 1000 m) |
| S0-14 Clock/IdGenerator | pass | ports with TSDoc in `src/shared/application`; `fake-clock.test.ts`, `sequential-id-generator.test.ts`, `system-clock.test.ts`, `crypto-id-generator.test.ts`; shared `clock.contract.ts` and `id-generator.contract.ts` run against fake and real adapter. "Works in Expo Go" for `expo-crypto`: device |
| S0-15 DI container | pass | `container.test.ts` (typed resolve, unregistered token message, test overrides, lazy singleton once); adapter construction outside `src/core/di` is a lint error (`boundaries.test.ts`) |
| S0-16 React binding | pass | `dependency-provider.test.tsx` (inside/outside provider); screen tests render with test containers (`app-bootstrap-gate.test.tsx`) |
| S0-17 App bootstrap | pass, device | `bootstrapper.test.ts`, `composition-root.test.ts`, `use-bootstrap.test.tsx`, `app-bootstrap-gate.test.tsx` (loading label, error screen with message, tabs only after success, failure logged). No-white-screen and real SQLite open on the phone: device |
| S0-18 SQLite + Drizzle client | pass, device | `expo-sqlite-database.test.ts` (expo-sqlite through Drizzle, native boundary mocked); `test/support/sqlite-test-database.test.ts` (fresh, isolated `:memory:` per test); import restriction via boundaries. Real expo-sqlite in Expo Go: device |
| S0-19 Migration runner | pass | `sqlite-database-migrator.test.ts` (all in order + version, idempotent, only N+1..N+2, failing migration rolled back with `db.migrationFailed`, open failures, newer database untouched); `database-migrator.contract.ts` run against fake and SQLite; bundling in ADR-001 §11 |
| S0-20 Contract harness | pass | `test/contracts/contract-harness.test.ts`; `sample-note-repository.test.ts` runs one contract against in-memory and SQLite (fresh database per case), test-only under `test/` |
| S0-21 Routine tree types | pass | `routine.ts` matches the data model; `routine.test.ts` (nesting, union, exhaustiveness via @ts-expect-error, read-only, value objects); builders in `test/builders` used by routine tests |
| S0-22 Routine validation | pass | `validate-routine.test.ts` (every rule, all problems with paths, random valid trees always pass, one broken rule at a random node reports exactly that path) |
| S0-23 Tab skeleton | pass, device | `app-tabs.test.tsx` (exactly 5 tabs in order, each navigates), 5 screen tests (title + "coming soon" by label), thin routes in `app/(tabs)/*.tsx` (one-line re-exports), Progress from `stats`, tokens from `shared/ui`; presentation/shared-ui coverage 100%. Real look on Android: device |
| S0-24 Stryker | pass | `npm run test:mutation` mutates only the domain globs, writes the text (terminal), HTML and JSON reports; run 1 87.18%, run 2 100%; not part of `npm test` |
| S0-25 Maestro smoke flow | device | flow + README written and syntax-validated; **not executed** (no Maestro, no device) |
| S0-26 ADR-001 | pass | layering, modules/public API, DI, aliases, boundary tooling and why, coverage per layer incl. core 90% and exclusions, speed budget, migration bundling, patterns with reasons (§12) |
| S0-27 ADR-002 | pass | timestamp timer from `Clock`, flatten to `Step[]`, State pattern, Observer cues, background notifications + rebuild, Expo Go limits, dev-build triggers, Sprint 4 risks (notification timing, battery optimisation, Doze) |
| S0-28 CI | pass (static) | `.github/workflows/ci.yml`: push + pull_request, `npm ci`, `.nvmrc`, npm cache, tsc, lint, format:check, `npm test -- --coverage --ci`, separate expo-doctor step, no secrets. Not run on GitHub yet (no remote) |

**Totals: 28 stories — 23 pass, 4 pass with a device check still open (S0-01, S0-17, S0-18,
S0-23), 1 needs the device run (S0-25), 0 fail.**

### Standards compliance

| Check | Result |
|---|---|
| Boundary lint / layer violations | lint exit 0; live violation demo fails as expected; manual review of `app/`, `src/core`, modules: no layer or module-internal imports |
| `any` / `@ts-ignore` / `@ts-nocheck` | none in `src/`, `app/`, `test/` (grep). `@ts-expect-error` only in `*.test.ts` compile-time type tests, each with a description |
| `eslint-disable` | none outside the lint-rule tests' fixture strings |
| `.skip` / `.only` / `xit` / `fit` / `todo` | none outside the lint-rule tests' fixture strings |
| Snapshot tests | none (0 snapshots) |
| Assertion-free tests | `jest/expect-expect` is on and lint passes. Compile-time tests in `routine.test.ts:61-89` carry placeholder runtime assertions (`expect(mutate).toBeInstanceOf(Function)`); the real check is `tsc` on the `@ts-expect-error` lines, which is the agreed pattern |
| Contract tests | Clock, IdGenerator, DatabaseMigrator and the sample repository: fake + real adapter. **Logger has none**, see Q-3 |
| Coverage thresholds enforced | yes: thresholds per layer in `tooling/jest/coverage-policy.js`, enforcement proven by `coverage-enforcement.test.ts`, floors pinned by `coverage-policy.test.ts`; current run 100/100/100/100 |
| TODOs without BACKLOG item | none (no TODO/FIXME in code) |
| File size | all ≤ 250 lines except `tooling/eslint/boundaries.test.ts` (349, carry-over item 8) |

### Tests added by QA

All were seen **failing against the surviving mutants** in the first Stryker run (each mutant is the
broken implementation) and pass on the real code; the second Stryker run confirms they kill them.

| File | Test | Kills |
|---|---|---|
| `src/shared/domain/numbers.test.ts` | "includes the tolerance itself: a difference of exactly the tolerance is still equal" | `numbers.ts:22` `<=` → `<` |
| `src/modules/routines/domain/validate-routine.test.ts` | "messages › explains every kind of problem with its own readable message, for the editor to show" (one routine triggers all 8 codes; non-blank, distinct messages; the code list is a `Record<RoutineValidationCode, true>`, so a new code is a compile error) | `validate-routine.ts:33-40` (8 messages) |
| same | "messages › summarises how many problems the routine has" | `validate-routine.ts:153` |
| `weight.test.ts`, `distance.test.ts`, `duration.test.ts`, `instant.test.ts` | the existing "rejects %p" cases now also require `message: expect.stringMatching(/\S/)` (S0-09: errors carry a human-readable message) | `weight.ts:34`, `distance.ts:40`, `duration.ts:28`, `instant.ts:23` |
| `id.test.ts` | the existing "rejects the empty or whitespace-only string" case now requires the message to name the id type | `id.ts:20` |

No production code was changed by QA.

### Bugs and findings

| # | Severity | Where | Problem | Steps to reproduce | Owner |
|---|---|---|---|---|---|
| Q-1 | low | `src/shared/domain/numbers.ts:12-14` (used by `weight.ts:25`, `duration.ts:16`, `distance.ts:28`) | Negative zero is accepted and stored as `-0`. `Intl.NumberFormat('en').format(weightIn(w, 'kg'))` shows **"-0"**, and `-0` arises easily from UI input (`Number('-0')`, `Math.round(-0.4)`, `0 * -1` in a stepper) | `createWeight(-0, 'kg')` → `ok`; `Object.is(weightIn(w, 'kg'), -0)` is `true`; the formatted value is `"-0"` (same for `durationFromSeconds(-0)` and `createDistance(-0, 'km')`). Verified with a throw-away Jest probe | core-dev, Sprint 1: normalise `-0` to `0` in the factories (test-first) |
| Q-2 | info | `stryker.config.json` | 133 of 250 mutants are not scored (130 rejected by the TypeScript checker, 3 crash at module load), and Stryker warns that 47 static mutants take 87% of the run time. The run takes ~3.5 min, which is acceptable for an end-of-sprint check | `npm run test:mutation` | architect (watch as the domain grows) |
| Q-3 | low | `test/fakes/README.md:10-11`, `test/fakes/recording-logger.ts` | The README says "every fake must pass the port's contract suite", but `RecordingLogger` and `ConsoleLogger` have no shared `Logger` contract (the Interfaces section says "logger if it ever has behaviour worth a contract"). The rule and the exception disagree | read both files | architect: add a minimal Logger contract, or write the exception into the README |
| Q-4 | low | repository | `git log`: "your current branch 'main' does not have any commits yet". S0-01 asks for a versioned baseline; CI can't run until there is a commit and a remote | `git log` | user / main session at sprint sign-off (QA was told not to commit) |
| Q-5 | risk | `e2e/flows/smoke-tabs.yaml` | Not executed. Unverified on Android: the `"<Tab> screen"` content description on `SafeAreaView` being visible to Maestro, and Expo Go's first-run dialogs | run the checklist below plus `npm run e2e` | qa-engineer on first device run; ui-dev only if a `testID` fallback is needed |

No failing acceptance criteria and no production defects above low severity were found.

### Manual test checklist (Expo Go on Android)

Setup
1. Phone: install **Expo Go** from the Play Store (SDK 58 support). Phone and computer on the same Wi-Fi.
2. Computer: `cd ExerciseTracker && nvm use && npm install && npm start`.
3. Expo Go → *Scan QR code* → scan the QR in the terminal. (No QR scan? Type the `exp://…:8081` URL in Expo Go, or use USB with `adb reverse tcp:8081 tcp:8081` and `npm start -- --localhost`.)

Startup (S0-17)
4. [ ] While the bundle loads and right after: no blank white screen; a spinner with "Loading Exercise Tracker" may flash briefly, then the tabs appear.
5. [ ] No red error screen and no "Startup failed" screen. The terminal shows `[exercise-tracker] Database ready` with `fromVersion 0, toVersion 0`.
6. [ ] Kill Expo Go and reopen the project: it starts again without errors (database reopened, migrations idempotent).

Tabs (S0-23)
7. [ ] Exactly 5 tabs at the bottom, in this order: **Workout, Routines, Exercises, Progress, Settings** (labels only, no icons yet).
8. [ ] The app opens on **Workout**.
9. [ ] Tap each tab: the screen shows its title as a big heading (same word as the tab) and a short muted line ending in "Coming soon."
10. [ ] The selected tab label is highlighted in the accent colour; the others are muted.
11. [ ] Content is not hidden under the status bar or the camera notch, and the tab bar is not covered by the Android navigation bar.

Theme
12. [ ] Android *Settings → Display → Dark theme* **off**: white background, dark text, light-grey tab bar.
13. [ ] Dark theme **on** (switch while the app is open, then return): near-black background, light text, dark tab bar; the status-bar icons stay readable in both modes.
14. [ ] Text is readable at arm's length in both modes (headings large and bold).

Accessibility
15. [ ] Turn on TalkBack: each tab is announced by its name ("Workout", "Routines", …); the heading is announced as a heading; the screen is announced as "<Tab> screen". Turn TalkBack off.

Robustness
16. [ ] Rotate the phone: the app stays portrait (orientation locked).
17. [ ] Shake → *Reload*: the app reloads through the loading state to the Workout tab without errors.
18. [ ] Background the app for a minute and return: still on the same tab, no crash.

E2E (optional, needs Maestro + adb, see `e2e/README.md`)
19. [ ] `adb reverse tcp:8081 tcp:8081 && npm run e2e` (or `npm run e2e -- -e EXPO_URL=exp://<LAN-IP>:8081`) passes. Report back the output so S0-25 can be closed.

Report any failed step with the step number, phone model and Android version, and a screenshot.
