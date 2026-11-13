# Backlog

Maintained by the product-owner. Requirements come from `PLAN.md`. Stories and acceptance criteria are in `docs/sprints/sprint-N.md`. Under the engineering standards, every TODO in code must have a matching item here.

## In progress

### Sprint 0 — Foundations (`docs/sprints/sprint-0.md`)

| ID | Story | Module | Owner |
|---|---|---|---|
| S0-01 | Expo + TypeScript project and git repository | tooling | architect |
| S0-02 | TypeScript strict + `noUncheckedIndexedAccess` | tooling | architect |
| S0-03 | ESLint + Prettier with code-quality rules | tooling | architect |
| S0-04 | Jest + RNTL + fast-check | tooling | architect |
| S0-05 | Per-layer coverage thresholds | tooling | architect |
| S0-06 | Clean Architecture folder skeleton + path aliases (`test/fakes`, `test/builders`) | core / shared / modules | architect |
| S0-07 | Boundary enforcement (layers, modules, cycles, test imports) | tooling | architect |
| S0-08 | `Result` type | shared/domain | core-dev |
| S0-09 | Base domain error | shared/domain | core-dev |
| S0-10 | Branded IDs | shared/domain | core-dev |
| S0-11 | `Weight` value object | shared/domain | core-dev |
| S0-12 | `Duration` value object | shared/domain | core-dev |
| S0-13 | `Distance` value object | shared/domain | core-dev |
| S0-14 | `Clock` / `IdGenerator` ports, system adapters, fakes | shared/application, shared/infrastructure | core-dev |
| S0-15 | DI container (composition root) | core | core-dev |
| S0-16 | React binding for the container | core | ui-dev |
| S0-17 | App bootstrap (open DB, migrate, loading/error states) | core, app | core-dev + ui-dev |
| S0-18 | SQLite + Drizzle database client | shared/infrastructure | core-dev |
| S0-19 | Migration runner | shared/infrastructure | core-dev |
| S0-20 | Repository contract-test harness | test, shared/infrastructure | core-dev (qa review) |
| S0-21 | Routine tree types (Composite) + builders | routines/domain | core-dev |
| S0-22 | Routine tree validation | routines/domain | core-dev |
| S0-23 | expo-router 5-tab skeleton | app, presentation, shared/ui | ui-dev |
| S0-24 | Stryker mutation testing on domain | tooling | qa-engineer |
| S0-25 | Maestro smoke flow | tooling (e2e) | qa-engineer |
| S0-26 | ADR-001 Architecture | docs | architect |
| S0-27 | ADR-002 Timer strategy | docs | architect |
| S0-28 | GitHub Actions CI | tooling | architect |

## Todo (epics, broken into stories at sprint planning)

### Carry-over from Sprint 0 design review (do in Sprint 1)
- ui-dev: tab icons via `npx expo install @expo/vector-icons` (test-first) — `src/core/presentation/app-tabs.tsx`
- ui-dev: `accessibilityLiveRegion` announcement on `ErrorState` when first used inline — `src/shared/ui/error-state.tsx`
- architect: split `tooling/eslint/boundaries.test.ts` (349 lines) by concern
- core-dev: switch `APP_MIGRATIONS` to `migrationsFromDrizzleKit(generatedBundle)` when the first `*.schema.ts` lands — `src/shared/infrastructure/db/app-migrations.ts`
- core-dev: Q-1 normalise `-0` to `0` in Weight/Duration/Distance factories (test-first) — `src/shared/domain/numbers.ts:12`
- architect: Q-3 add a minimal Logger contract or document the exception in `test/fakes/README.md`
- ui-dev: run the Maestro smoke flow on a device; add `testID` to `Screen` if labels aren't visible to Maestro (Q-5)
- architect (Sprint 3): decide where `flatten` lives / how `workout` reads the routine tree (options in ADR-001, preference in ADR-002)

### E1 — Sprint 1: Exercise library (modules: exercises)
- Seed built-in library from free-exercise-db (~800 exercises, muscles, equipment, instructions, images)
- Browse / search / filter by muscle, equipment, category; exercise detail with image gallery
- Create / edit / delete custom exercises: photos from camera/gallery, choose tracked metrics
- Demo: find "Squat", view images; create your own exercise with a photo

### E2 — Sprint 2: Routine builder (modules: routines)
- Create / edit / duplicate / delete routines
- Nested block editor: add block / exercise / rest, set repeat count, reorder, collapse
- Per-set config: timed vs reps, targets, rest after each set, rest between rounds
- Templates: Tabata, EMOM, superset, pyramid
- Live preview: total duration estimate + flattened step list
- Demo: build "3 rounds of (Pushups 40s / rest 20s / Squats 12 reps) + 90s rest"

### E3 — Sprint 3: Timer engine & workout player (modules: workout)
- `flatten()` + engine state machine (nesting, repeats, skip, pause, rep-based)
- Player screen: big countdown, current/next step, round counter, progress bar, pause/skip/back
- Audio beeps, 3-2-1 countdown, voice cues, haptics, keep screen awake
- Quick logging per set (reps, weight, RPE, prefilled from targets/last session)
- Demo: run a full routine with sound/vibration and log sets

### E4 — Sprint 4: Background, sessions & history (modules: workout, history)
- Background/lock screen: scheduled notifications per phase, rebuild state when the app returns
- Sessions saved with all set logs, actual work/rest times
- History list + session detail; edit/delete past logs; free-form "quick workout"
- Demo: lock the phone during rest, get a notification + vibration; see the session in history

### E5 — Sprint 5: Statistics & progress (modules: stats, body)
- Per-exercise charts: max weight, est. 1RM, volume, reps, duration, distance over time
- Personal records + PR badges during workouts
- Weekly/monthly summaries, calendar heatmap
- Body measurements: log + trend charts
- Demo: progress graphs from seeded sample data and your own sessions

### E6 — Sprint 6: Polish & release prep (modules: settings, backup, all)
- Settings: kg/lb, sound/voice/vibration toggles, default rest times, theme (dark mode)
- JSON export/import backup (including custom images)
- Performance pass, accessibility, empty states, QA regression
- Optional: development build / APK if background timing needs a foreground service
- Demo: installable build, backup + restore

## Done

_Nothing yet._

## Deferred

- **CD via EAS** (EAS Update to Expo Go / EAS Build): needs an Expo account and an `EXPO_TOKEN` GitHub secret. Revisit once the GitHub repo exists.
