# Exercise Tracker — Project Plan

## 1. Requirements (agreed)

| Area | Decision |
|---|---|
| Platform | Native mobile, **Android first**, run via **Expo Go** during development |
| Storage | **Local only** (SQLite on device) + JSON export/import for backup. Single user, no accounts |
| Exercises | Built-in library (seeded from the open-licensed *free-exercise-db*, with images) **plus** fully configurable custom exercises (name, muscles, equipment, instructions, own photos, which metrics are tracked) |
| Routines | **Nested blocks**: a routine is a tree; a block holds exercises, rests or other blocks and repeats N times (circuits, supersets, EMOM, Tabata, pyramids) |
| Steps | Timed (work X s) **or** rep-based ("until done", tap to finish); per-set rest; per-set targets (reps, weight, time, distance) |
| Timer | Sound + spoken cues (3-2-1, "Rest", "Next: Squats"), vibration, keeps working in background / lock screen |
| Metrics logged | Weight, reps, time/duration (work and rest actually taken), distance, RPE, body measurements (bodyweight, body fat %, circumferences) |
| Stats | Progress charts per exercise (max weight, est. 1RM, volume, reps, duration, distance), PRs, session history, body measurement trends |
| Workflow | Agent dev team works in sprints; **pause for user review after each sprint** |

## 2. Tech stack

- **Expo (latest SDK) + React Native + TypeScript**, `expo-router` for navigation
- **expo-sqlite + Drizzle ORM** (typed schema, migrations)
- **Zustand** for UI/workout state
- `expo-image` (cached images), `expo-image-picker` (camera/gallery for custom exercises), `expo-file-system`
- `expo-audio` (beeps), `expo-speech` (voice), `expo-haptics`, `expo-keep-awake`, `expo-notifications` (scheduled local notifications for phase changes while backgrounded)
- Charts: `react-native-gifted-charts` (works in Expo Go)
- Tests (strict TDD from day one): Jest + React Native Testing Library, `fast-check` (property-based), Stryker (mutation, domain), Maestro (E2E on Android); per-layer coverage thresholds enforced (domain 100%)
- ESLint + Prettier; TypeScript strict

**Expo Go limitation:** Expo Go can't run a true Android foreground service. The timer is **timestamp-based**: elapsed time comes from wall-clock time, not counting ticks. When the app goes to the background, every upcoming phase change is scheduled as a local notification with sound and vibration. When the app returns, state is rebuilt from the timestamps. If that turns out not to be reliable enough, a later sprint can move to an Expo **development build** with a foreground service.

## 3. Architecture

**Modular Clean Architecture (ports & adapters)**. The full rules are in `docs/ENGINEERING_STANDARDS.md` and are enforced with lint boundary rules.

```
presentation ──► application ──► domain        (dependencies point inward only)
                     ▲
infrastructure ──────┘  implements application ports (SQLite, expo-audio, notifications…)
```

```
app/                     thin expo-router routes (tabs: Workout, Routines, Exercises, Progress, Settings)
src/core/                DI container / composition root, config, bootstrap
src/shared/              domain (Result, IDs, Weight/Duration/Distance value objects), ports, DB client, ui design system
src/modules/
  exercises/             each module: domain / application / infrastructure / presentation / index.ts
  routines/              routine tree (nested blocks), validation, templates
  workout/               timer engine: flatten(routine) -> Step[], state machine; player; set logging
  history/  stats/  body/  settings/  backup/
assets/exercise-db/      seeded exercise JSON (+ images fetched once and cached)
```

- Modules expose a public API only through `index.ts` and communicate through use cases or domain events (e.g. `WorkoutCompleted`).
- Every Expo/DB API sits behind a port (`Clock`, `AudioCuePlayer`, `NotificationScheduler`, `ExerciseRepository`…), so the domain is pure and adapters can be swapped.
- New step types, metrics and cue types plug in through registries/strategies (Open/Closed).
- Design patterns are used where they fit, e.g. Composite (routine tree), State (timer), Observer (cues), Command (player actions), Strategy (step kinds, 1RM formulas), Repository/Unit of Work (persistence). See the standards, §2.

### Core data model
- **Exercise**: id, name, category, primaryMuscles[], secondaryMuscles[], equipment, instructions, images[], trackedMetrics (weight/reps/time/distance/rpe), isCustom
- **Routine**: id, name, notes, root: **Block**
- **Block**: id, label, repeat (N), restBetweenRounds, children: (Block | ExerciseStep | RestStep)[]
- **ExerciseStep**: id, exerciseId, mode (`timed` | `reps`), sets[] each with target {reps, weight, durationSec, distance}, restAfterSec
- **RestStep**: id, durationSec
- Every tree node has a branded id. Routines may be saved as incomplete drafts; full validation is required before starting a workout. Units: kg/lb, m/km/mi (full precision stored, rounded for display).
- **Session**: id, routineId, snapshot of routine, startedAt, endedAt, notes
- **SetLog**: sessionId, exerciseId, blockPath/round, setIndex, reps, weight, durationSec, distance, rpe, restTakenSec, completedAt
- **BodyMeasurement**: date, type (bodyweight, bodyfat, waist, …), value, unit

The timer engine flattens the routine tree into a linear list of steps (expanding repeats and nesting). The player walks through that list, which keeps the engine simple, deterministic and easy to test.

## 4. Dev team (agents in `.claude/agents/`)

| Agent | Role |
|---|---|
| `product-owner` | Turns requirements into user stories with acceptance criteria, keeps the backlog, writes the sprint review |
| `architect` | Tech decisions, data model, folder structure, reviews PRs for design consistency |
| `core-dev` | Domain logic, DB, timer engine, services (audio/notifications/backup) — test-first |
| `ui-dev` | Screens, components, navigation, forms, charts |
| `qa-engineer` | Writes/maintains tests, runs typecheck/lint/tests, reviews against acceptance criteria, reports bugs |

Sprint loop: **Plan** (product-owner writes Given/When/Then criteria, architect defines ports) → **Build with TDD** (core-dev and ui-dev work in parallel on separate areas) → **Verify** (qa-engineer) → **Review** (I summarise the demo and what to try in Expo Go; you approve or request changes).

## 5. Sprint roadmap

### Sprint 0 — Foundations
- **Test infrastructure first:** Jest + RNTL + fast-check, coverage thresholds per layer, `test/fakes` + `test/builders`, Stryker, Maestro smoke flow
- Expo + TS project, expo-router tabs skeleton, ESLint/Prettier/Jest, git init
- Clean Architecture skeleton: `core/`, `shared/`, module folders, DI container, path aliases
- Boundary enforcement (`eslint-plugin-boundaries` / `dependency-cruiser`), TS strict + `noUncheckedIndexedAccess`
- Shared kernel: `Result`, branded IDs, unit value objects, `Clock`/`IdGenerator` ports
- SQLite + Drizzle client & migration runner; repository contract-test harness
- Domain types for the routine tree
- ADR-001 (architecture) and ADR-002 (timer strategy)
- **Demo:** app opens in Expo Go with 5 empty tabs; `npm test -- --coverage` green with thresholds enforced

### Sprint 0.5 — Continuous delivery & self-update
- On every push to `main`, after the quality gates pass, GitHub Actions builds a **signed release APK with Gradle** (no EAS, no Expo account) and publishes it as a **GitHub Release** on `difcortesgu/ExerciseTracker`; a failing gate means no release
- One fixed signing key from 4 repo secrets, so every APK installs over the previous one; monotonically increasing build number (= Android versionCode)
- In-app self-update: at startup the app checks the latest GitHub Release and, if the build is strictly newer, asks "Build N available – Update / Later", downloads with progress and opens Android's system installer (the user always confirms; never silent). Never blocks startup; inactive in Expo Go and dev builds
- README: first install, "install unknown apps" permission, secrets, keystore loss; ADR-003
- **Demo:** push to `main` → release with APK → install on the phone → push again → the app offers the new build and updates itself, keeping its data

### Sprint 1 — Exercise library
- Seed built-in library (free-exercise-db: ~800 exercises, muscles, equipment, instructions, images)
- Browse/search/filter by muscle, equipment, category; exercise detail with image gallery
- Create/edit/delete custom exercises: photos from camera/gallery, choose tracked metrics
- **Demo:** find "Squat", view images; create your own exercise with a photo

### Sprint 2 — Routine builder
- Create/edit/duplicate/delete routines
- Nested block editor: add block / exercise / rest, set repeat count, reorder, collapse
- Per-set config: timed vs reps, targets, rest after each set, rest between rounds
- Templates: Tabata, EMOM, superset, pyramid
- Live preview: total duration estimate + flattened step list
- **Demo:** build "3 rounds of (Pushups 40s / rest 20s / Squats 12 reps) + 90s rest"

### Sprint 3 — Timer engine & workout player
- `flatten()` + engine state machine (unit tested heavily: nesting, repeats, skip, pause, rep-based)
- Player screen: big countdown, current/next step, round counter, progress bar, pause/skip/back
- Audio beeps, 3-2-1 countdown, voice cues, haptics, keep screen awake
- Quick logging for each set (reps, weight, RPE, prefilled from targets/last session)
- **Demo:** run a full routine with sound/vibration and log sets

### Sprint 4 — Background, sessions & history
- Background/lock screen: scheduled notifications for each phase, rebuild state when the app returns
- Sessions saved with all set logs, actual work/rest times
- History list + session detail; edit/delete past logs; free-form "quick workout" without a routine
- **Demo:** lock the phone during rest, get a notification + vibration; see the session in history

### Sprint 5 — Statistics & progress
- Per-exercise charts: max weight, est. 1RM, volume, reps, duration, distance over time
- Personal records + PR badges during workouts
- Weekly/monthly summaries (sessions, volume, time trained), calendar heatmap
- Body measurements: log + trend charts
- **Demo:** progress graphs from seeded sample data and your own sessions

### Sprint 6 — Polish & release prep
- Settings: kg/lb, sound/voice/vibration toggles, default rest times, theme (dark mode)
- JSON export/import backup (including custom images)
- Performance pass, accessibility, empty states, QA regression
- Optional: switch to a development build / APK if background timing needs a foreground service
- **Demo:** installable build, backup + restore

## 6. Definition of done (every story)
See `docs/ENGINEERING_STANDARDS.md` §6: acceptance criteria met, layer/module boundaries respected (lint passes), typecheck and tests green with TDD for domain logic, no duplicated business logic, architect review done, runs in Expo Go on Android.
