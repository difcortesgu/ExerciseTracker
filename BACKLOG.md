# Backlog

Maintained by the product-owner. Requirements come from `PLAN.md`. Stories and acceptance criteria are in `docs/sprints/sprint-N.md`. Under the engineering standards, every TODO in code must have a matching item here.

## In progress

### Sprint 1 — Exercise library (`docs/sprints/sprint-1.md`)

Status: planned (2026-11-16); the user answered Q1–Q6 the same day (archive on delete, duplicate as custom, default metrics table, on-demand images + "download all", own vocabulary values, names unique across all). Waiting for architect Phase 1.

| ID | Story | Module | Owner |
|---|---|---|---|
| S1-01 | Normalise `-0` in unit value objects (Sprint 0 Q-1) | shared/domain | core-dev |
| S1-02 | Logger contract, or a documented exception (Sprint 0 Q-3) | test/contracts, shared | architect |
| S1-03 | Split `boundaries.test.ts` by concern | tooling | architect |
| S1-04 | First module schema; migrations from the drizzle-kit bundle | exercises/infrastructure, shared/infrastructure | core-dev |
| S1-05 | Tab bar icons | core/presentation | ui-dev |
| S1-06 | Shared `Button` in the design system (B05-1) | shared/ui, updates/presentation | ui-dev |
| S1-07 | `ErrorState` announces itself when shown inline | shared/ui | ui-dev |
| S1-08 | Exercise entity and validation rules | exercises/domain | core-dev |
| S1-09 | Search, filter and sort (case/accent-insensitive, combinable) | exercises/domain or application | core-dev |
| S1-10 | Default tracked metrics for built-in exercises | exercises/domain | core-dev |
| S1-11 | Pin, convert and bundle the free-exercise-db dataset (licence check) | tooling, assets | architect |
| S1-12 | Idempotent, versioned seeding (never touches custom exercises) | exercises/application, infrastructure | core-dev |
| S1-13 | Seed at startup without blocking it; failure + retry | exercises/application, core | core-dev + ui-dev |
| S1-14 | Exercise repository (ports, SQLite adapter, contract suite) | exercises/application, infrastructure | core-dev |
| S1-15 | Browse and find exercises (use cases) | exercises/application | core-dev |
| S1-16 | Exercise library screen: list, search, filters, states | exercises/presentation, app | ui-dev |
| S1-17 | Exercise detail with image gallery (root layout becomes a `Stack`) | exercises/presentation, app, core | ui-dev |
| S1-18 | Built-in images: fetched once, cached, defined offline behaviour | exercises (application, infrastructure, presentation) | core-dev + ui-dev |
| S1-19 | Create a custom exercise | exercises (all layers), app | core-dev + ui-dev |
| S1-20 | Edit a custom exercise | exercises (all layers) | core-dev + ui-dev |
| S1-21 | Delete a custom exercise (archive, Q1) | exercises (all layers) | core-dev + ui-dev |
| S1-22 | Custom photos from camera or gallery, owned by the app | exercises (all layers) | core-dev + ui-dev |
| S1-23 | Duplicate a built-in exercise as custom (Q2) | exercises/application, presentation | core-dev + ui-dev |
| S1-24 | Data attribution in Settings | settings/presentation | ui-dev |
| S1-25 | Maestro flow for the demo journey; first device run of the smoke flow (Q-5) | e2e | qa-engineer (+ ui-dev testIDs) |
| S1-26 | On-device verification (Expo Go and release APK, update from 0.5), incl. pending S05-14 | tooling (manual) | qa-engineer |
| S1-27 | ADR-004 Exercise library | docs | architect |
| S1-28 | Download all built-in images for offline use (user-triggered, Q4) | exercises (application, infrastructure, presentation), settings/presentation | core-dev + ui-dev |
| S1-29 | User-defined categories, muscles and equipment (Q5) | exercises (all layers) | core-dev + ui-dev |

## Done

### Sprint 0.5 — Continuous delivery & self-update (`docs/sprints/sprint-0.5.md`)

Done and committed (commit `2555c38`, follow-ups `d85ed08` Node 26 toolchain and `b5b9eff` release key alias docs). The feature lives in the module `src/modules/updates/` (architect answer A1; it is no longer a placeholder name). The first real GitHub release run succeeded (user, 2026-11-16: a release APK was published). Still open: the on-device verification S05-14 (sprint-0.5 checklist steps 2–8), folded into Sprint 1 story S1-26; the assumed answers Q1–Q6 of Sprint 0.5 await user confirmation.

| ID | Story | Module | Owner |
|---|---|---|---|
| S05-01 | Monotonically increasing build number (= Android versionCode) | tooling | architect |
| S05-02 | Signed release APK built in CI (Gradle, 4 secrets, fingerprint check) | tooling | architect |
| S05-03 | Publish a GitHub Release on every push to `main`, only after all gates pass | tooling | architect |
| S05-04 | Every release installs over the previous one | tooling | architect |
| S05-05 | Update decision: offer only a strictly newer build; release parsing | updates/domain | core-dev |
| S05-06 | Check for an update at startup; never blocks, inactive in Expo Go | updates/application | core-dev |
| S05-07 | GitHub latest-release adapter (timeouts, rate limit, malformed data) | updates/infrastructure | core-dev |
| S05-08 | Startup update prompt "Build N available – Update / Later" | updates/presentation, core | ui-dev |
| S05-09 | Download with progress, cancel, error and retry | updates (all layers) | core-dev + ui-dev |
| S05-10 | Hand the APK to Android's system installer (user confirms) | updates (all layers) | core-dev + ui-dev |
| S05-11 | Show the installed build in Settings | settings/presentation, updates | ui-dev |
| S05-12 | README: install, update, secrets, keystore loss | docs | architect |
| S05-13 | ADR-003 Release builds and self-update | docs | architect |
| S05-14 | On-device update verification | tooling (manual) | qa-engineer — **pending, folded into S1-26** |

### Sprint 0 — Foundations (`docs/sprints/sprint-0.md`)

Done per the main session (2026-11-13). Device checks still open from the Sprint 0 QA report are tracked under "Carry-over from Sprint 0" (Maestro run).

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

### Carry-over from Sprint 0 design review
Folded into Sprint 1 (2026-11-16): tab icons → S1-05; `ErrorState` live region → S1-07; split `boundaries.test.ts` → S1-03; `APP_MIGRATIONS` from the drizzle-kit bundle → S1-04; Q-1 `-0` normalisation → S1-01; Q-3 Logger contract → S1-02; Maestro device run / `testID` (Q-5) → S1-25.
- architect (Sprint 3): decide where `flatten` lives / how `workout` reads the routine tree (options in ADR-001, preference in ADR-002)

### Carry-over from Sprint 0.5
- done (2026-11-16): first real release run on GitHub succeeded, a release APK was published
- user (qa-engineer checklist): on-device verification S05-14 (sprint-0.5 checklist steps 2–8) → folded into S1-26
- user: confirm or override the assumed answers Q1–Q6 in `docs/sprints/sprint-0.5.md`
- done (2026-11-16, architect, Sprint 1 Phase 1): ADR-003 status records the successful first real release run (it was already Accepted; S05-14 still pending)
- B05-1 promote `PromptButton` to `shared/ui` `Button` → folded into Sprint 1 as S1-06
- B05-2 architect: measure the size of the reanimated/worklets native code in the APK; consider an autolinking exclude only after a device check
- B05-3 core-dev: split `src/modules/updates/infrastructure/github-release-source.test.ts` (292 lines) by behaviour group, next time it changes
- B05-4 done: `BACKLOG.md` no longer calls `updates` a placeholder (2026-11-16)

### E1 — Sprint 1: Exercise library (modules: exercises)
Broken into stories S1-01 to S1-29; see "In progress" and `docs/sprints/sprint-1.md`.

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
- architect (from ADR-004): exclude `exercise-images/` (≈ 99 MB after a full image download) from Android Auto Backup, or disable Auto Backup in favour of the JSON backup — above 25 MB Android stops backing up the app entirely
- Performance pass, accessibility, empty states, QA regression
- Optional: development build / APK if background timing needs a foreground service
- Demo: installable build, backup + restore

## Deferred

- ~~**CD via EAS** (EAS Update to Expo Go / EAS Build)~~: **superseded on 2026-11-13.** The user chose continuous delivery without EAS or an Expo account: GitHub Actions builds a signed APK with Gradle and publishes it as a GitHub Release, and the app updates itself. Planned as Sprint 0.5 (`docs/sprints/sprint-0.5.md`). No `EXPO_TOKEN` is needed.
- **Over-the-air JS updates (EAS Update) and Play Store distribution:** not requested; would need an Expo account / Play Console. Revisit only if the user asks.
- **More update triggers** (check on resume, scheduled check, manual "Check for updates" in Settings): out of scope for Sprint 0.5 (open question Q3 there).
- **Remembering "Later" / skipping a build / mandatory updates:** out of scope for Sprint 0.5; "Later" applies to the current launch only.
- **Exercise library extras** (out of scope for Sprint 1, see `docs/sprints/sprint-1.md`): restoring deleted exercises / undo; managing own vocabulary values (rename, merge, delete your own categories/muscles/equipment; Sprint 1 decision Q5); multiple equipment per exercise; more filters (level, force, custom only), favourites, sorting options; photo reordering and a full-screen image viewer; automatic/scheduled image downloads, Wi-Fi-only setting, clearing the image cache from the app (Sprint 1 decision Q4: bulk download is user-triggered only). Revisit if the user asks.
