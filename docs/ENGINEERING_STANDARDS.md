# Engineering Standards

These rules are mandatory for every agent and every change. If a rule can't be followed, stop and explain why in your report. Don't quietly take a shortcut.

The goal is **code that is easy to refactor and extend**: you should be able to add a feature by adding code, not by editing code all over the app.

---

## 1. Architecture: modular Clean Architecture

### 1.1 Layers and the dependency rule

Every feature module has four layers. **Dependencies point inward only.**

```
presentation  ──►  application  ──►  domain
                        ▲
infrastructure ─────────┘   (implements application ports)
```

| Layer | Contains | May import | Must NOT import |
|---|---|---|---|
| **domain** | Entities, value objects, domain services, domain errors, pure business rules (routine tree, timer engine, 1RM math) | other domain code, `shared/domain` | React, React Native, Expo, Drizzle/SQLite, Zustand, any I/O, application, infrastructure, presentation |
| **application** | Use cases (one class/function per use case), **ports** (interfaces: `ExerciseRepository`, `Clock`, `AudioCuePlayer`, `NotificationScheduler`…), DTOs, mappers | domain, `shared/application` | React, Expo, Drizzle, infrastructure, presentation |
| **infrastructure** | **Adapters** that implement ports: Drizzle/SQLite repositories, expo-audio, expo-speech, expo-haptics, expo-notifications, file system, seeders | application (ports, DTOs), domain | presentation |
| **presentation** | expo-router screens, components, view-model hooks, UI state stores | application (use cases via DI, DTOs), `shared/ui` | infrastructure (never call SQLite/Expo services directly), domain internals that aren't exported |

- `app/` (expo-router routes) contains only **thin route files** that render a screen from a module's `presentation` layer.
- **Composition root** (`src/core/di/`): the only place where concrete adapters are created and wired to ports. Presentation gets use cases from the container (via a React context/hook), never by `new`-ing infrastructure.
- Expo/RN APIs are always hidden behind a port. Example: the timer engine depends on a `Clock` port, not `Date.now()`, so it is deterministic in tests.

### 1.2 Folder structure

```
app/                              thin expo-router routes only
src/
  core/                           cross-cutting: DI container, config, logger, app bootstrap
  shared/
    domain/                       Result type, Id, base errors, units (Weight, Duration, Distance) value objects
    application/                  shared port types (Clock, IdGenerator, UnitOfWork)
    infrastructure/               DB client, migrations runner, common adapters
    ui/                           design system: theme tokens, Button, Card, NumberInput, Screen…
  modules/
    exercises/   { domain, application, infrastructure, presentation, index.ts }
    routines/    { … }
    workout/     { … }            timer engine, player, session logging
    history/     { … }
    stats/       { … }
    body/        { … }            body measurements
    settings/    { … }
    backup/      { … }
```

### 1.3 Module boundaries
- Each module exposes a **public API only through its `index.ts`** (use cases, DTOs, port interfaces). Importing another module's internal files is forbidden.
- Modules talk to each other through public use cases or **domain events** (e.g. `WorkoutCompleted` → stats updates PRs). They never share tables or repositories directly.
- No circular dependencies between modules.
- These rules are **enforced by tooling** (`eslint-plugin-boundaries` and/or `dependency-cruiser`) set up in Sprint 0. A lint failure is a build failure.

---

## 2. Design principles

### SOLID
- **S – Single Responsibility:** one reason to change per class/module/function. One use case per file. Screens render; view-model hooks orchestrate; use cases decide; repositories persist.
- **O – Open/Closed:** add new behaviour by extension. New step types (e.g. `AmrapStep`), metrics or cue types are added by registering a new implementation (strategy/registry), **not** by adding `if/switch` branches across the codebase. One exhaustive `switch` on a discriminated union, inside the type's own module, is acceptable.
- **L – Liskov:** any adapter implementing a port must honour its full contract. In-memory and SQLite repositories must pass the **same shared contract test suite**.
- **I – Interface Segregation:** small, focused ports (`ExerciseReader` / `ExerciseWriter` when consumers differ). No "god" services.
- **D – Dependency Inversion:** high-level code depends on interfaces defined in the application layer; infrastructure implements them.

### DRY — without premature abstraction
- Business rules live in exactly one place (the domain). UI must not re-implement validation or calculations; it calls the domain/use case.
- Shared UI goes into `shared/ui`; shared value objects into `shared/domain`.
- Rule of three: duplicate once if needed, abstract when the third occurrence appears. Don't build speculative abstractions with a single implementation unless it's a port at a layer boundary.

### Other rules
- **KISS / YAGNI:** the simplest design that meets the acceptance criteria and keeps the layering intact.
- **Composition over inheritance.**
- **Immutability:** domain entities and value objects are immutable; state changes return new instances.
- **Make illegal states unrepresentable:** discriminated unions, branded IDs (`ExerciseId`, `RoutineId`), value objects with validation in their factory.
- **Explicit errors:** domain/application return a `Result<T, DomainError>` for expected failures; throw only for programmer errors. Never swallow errors.
- **Pure functions** for all calculations (timer flattening, stats); side effects only in infrastructure.

### Design patterns
Use well-known design patterns **when they solve a real problem** in the code: removing conditionals, decoupling, enabling extension or making testing easier. Never use them for their own sake.

- Every pattern used must be **named in the code** (class/file name or TSDoc, e.g. `RepRangeProgressionStrategy`, `StepFactory`) so its intent is obvious to the next developer.
- Choose the simplest pattern that solves the problem; in TypeScript a function or a map of functions often beats a class hierarchy.
- When introducing a pattern, the architect records why in an ADR (or a short note in the sprint file for small cases).
- **Over-engineering is also a shortcut violation**: no Abstract Factory with one product, no Visitor for two cases, no Singleton outside the composition root.

**Expected patterns in this app (guidance, not a checklist):**

| Problem in this app | Pattern |
|---|---|
| Routine = blocks containing blocks / exercises / rests | **Composite** (tree of `RoutineNode`) |
| Walking the routine tree (flatten, total duration, validation, summary) | **Visitor** or **Iterator** over the composite |
| Timer phases: idle → countdown → work → rest → paused → finished | **State** pattern / explicit state machine |
| Timer emits phase changes to audio, voice, haptics, notifications, UI | **Observer** (event bus / subscribers); each cue is a separate subscriber |
| Pause / skip / back / undo-last-set in the player | **Command** (with undo history) |
| Different step kinds (timed, reps, AMRAP, EMOM…) and metric types | **Strategy** + **Registry**, so new kinds are added without editing existing code |
| Stats: 1RM formulas (Epley, Brzycki), volume, PR detection | **Strategy** |
| Creating steps/routines from templates (Tabata, EMOM, pyramid) | **Factory** / **Builder** |
| Persistence | **Repository** + **Data Mapper**; **Unit of Work** for multi-table writes (session + set logs) |
| Wrapping Expo APIs (audio, speech, haptics, notifications, files) | **Adapter** (ports & adapters) |
| Logging/analytics/retry around services without touching them | **Decorator** |
| Module-to-module communication (`WorkoutCompleted` → stats/PRs) | **Domain Events** / **Mediator** |
| Wiring everything | **Dependency Injection** at the composition root |
| Screen ↔ logic separation | **MVVM** (screen + view-model hook) |
| Expected failures | **Result** type (no exceptions for control flow) |
| Backup export/import format versions | **Strategy** per version + **Chain of Responsibility** for migrations |

---

## 3. Code quality rules

- TypeScript `strict`, plus `noUncheckedIndexedAccess`. **No `any`, no `@ts-ignore`, no `eslint-disable`** without a written justification comment approved in review.
- No non-null assertions (`!`) in domain/application code.
- Clear names that say what something means (`restAfterSet`, not `r2`). No abbreviations except common ones (id, url, rpe).
- Functions stay small (aim for ≤ 30 lines) and do one thing. Files aim for ≤ 250 lines; split when larger.
- No magic numbers or strings: named constants or config.
- No hidden globals or singletons except the DI container at the composition root.
- Persistence models ≠ domain models: repositories map DB rows ⇄ domain entities with explicit mappers.
- Database changes only through versioned migrations; never edit a migration that has shipped.
- Comments explain *why*, not *what*. Public use cases and ports get a short TSDoc.
- Don't leave TODOs without a matching item in `BACKLOG.md`.

---

## 4. Test-Driven Development (mandatory from day one, all layers)

### 4.1 The TDD cycle — no production code without a failing test
1. **Red:** write the smallest test that describes the next behaviour, run it, and **see it fail for the right reason**.
2. **Green:** write the minimum production code to make it pass.
3. **Refactor:** clean up production *and* test code (DRY, naming, patterns) with all tests green.
4. Repeat. Commit at green; keep commits small (test + code together).

- Applies to **every layer** (domain, application, infrastructure, presentation) and to Sprint 0 tooling where testable (DI container, migrations runner, shared kernel).
- Acceptance criteria from the product-owner are turned into tests **before** implementation starts (outside-in: an acceptance/use-case test first, then unit tests drive the inner pieces).
- Every bug fix starts with a failing test that reproduces it.
- Agents must show TDD evidence in their report: list the tests written first and confirm they were seen failing before the implementation.

### 4.2 What to test per layer (test pyramid)

| Layer | Test type | Tools / approach | Coverage target |
|---|---|---|---|
| domain | Unit tests; **property-based tests** for the timer flatten/engine and stats math (e.g. "total duration = sum of steps × repeats") | Jest + `fast-check` | **100%** lines/branches |
| application | Use case tests with **in-memory fakes** of ports (no mocking of internals); domain event flows | Jest | **100%** lines, ≥ 95% branches |
| infrastructure | **Contract tests** per port, run against both the fake and the real adapter (SQLite through an in-memory/node SQLite driver; Expo modules through thin, tested adapters with mocked native module boundary); migration tests | Jest | ≥ 90% |
| presentation | View-model hook tests; component/screen tests on behaviour (what the user sees and does), not implementation details; accessibility labels used as queries | React Native Testing Library | ≥ 85% |
| end-to-end | Critical user journeys: create exercise → build routine → run workout with timer → session in history → stats updated | **Maestro** flows (run against Expo Go / dev build on Android) | key journeys per sprint |

### 4.3 Enforcement
- `jest.config` has **global and per-layer coverage thresholds** matching the table above; `npm test -- --coverage` fails the build below them.
- Thresholds may only go **up**, never down. Excluding files from coverage needs a justification comment and architect approval (only for pure wiring like route files and the generated migration SQL).
- Coverage is a floor, not the goal: **meaningful assertions** are required. Snapshot-only tests, tests without assertions and tests that only check that mocks were called don't count.
- Mutation testing (`Stryker`) runs on `domain` at the end of each sprint and should be ≥ 80%. The QA engineer reports surviving mutants.
- Forbidden: `.skip`, `.only`, `xit`, commented-out tests, or lowering thresholds to make CI green.

### 4.4 Test quality rules
- Tests are named for behaviour (`it('repeats nested blocks the configured number of times')`) and grouped by `describe` per use case/behaviour.
- Arrange-Act-Assert structure; one behaviour per test.
- **Test data builders / object mothers** (`aRoutine().withBlock(...).build()`) live in `test/builders` and are reused; no copy-pasted fixtures (DRY applies to tests).
- Deterministic tests: time through the `Clock` port (fake clock), IDs through `IdGenerator`, no real timers, network or randomness without a seed.
- Tests are fast: the whole unit + integration suite should run in seconds; slow tests are a bug.
- Test files sit next to the code (`*.test.ts(x)`); shared fakes in `test/fakes`, builders in `test/builders`.

---

## 5. Forbidden shortcuts

- Writing production code before a failing test (no test-after), or disabling/deleting/skipping a failing test or lowering coverage thresholds to make the build green.
- Calling SQLite, Expo APIs or `Date.now()` directly from screens, components or domain code.
- Copy-pasting logic between modules instead of extracting it to `shared` or exposing a use case.
- Reaching into another module's internals instead of its `index.ts`.
- `any`, type casts to silence errors, `// @ts-ignore`.
- Hard-coding data that belongs in the DB or config.
- Marking a task done without running typecheck, lint, boundary check and tests, or reporting results that weren't actually produced.

---

## 6. Definition of Done (every story)

1. Meets all acceptance criteria in `docs/sprints/sprint-N.md`.
2. Respects the layer and module boundaries; `npm run lint` (incl. boundary rules) passes.
3. Developed with TDD (§4.1); `npx tsc --noEmit` and `npm test -- --coverage` pass with all per-layer coverage thresholds met.
4. No duplicated business logic; new extension points documented.
5. Architect design review done; significant decisions recorded as ADRs in `docs/adr/`.
6. Runs in Expo Go on Android.
