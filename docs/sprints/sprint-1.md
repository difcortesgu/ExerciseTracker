# Sprint 1 — Exercise library

**Status:** Phase 1 (architect) done on 2026-11-16: T1–T9 ruled, dataset pinned and converted (S1-11), interfaces and Phase 2 ownership below, ADR-004 Proposed; S1-02 and S1-03 done. Ready for Phase 2 (core-dev + ui-dev). Not committed yet.
**Source:** `PLAN.md` §1 (Exercises row), §3 "Core data model" (Exercise), §5 "Sprint 1"; `BACKLOG.md` "Carry-over from Sprint 0 design review (do in Sprint 1)" and the Sprint 0.5 close-out item B05-1; rules in `docs/ENGINEERING_STANDARDS.md`. Started by the user on 2026-11-16 ("Sprint 1").

## Sprint goal

The Exercises tab becomes a real **exercise library**: 876 built-in exercises (pinned version; the plan said about 800) from the open-licensed *free-exercise-db* are available offline after the first launch, can be **searched and filtered** quickly, and each has a **detail screen with images**. The user can **create, edit and delete their own exercises**, with their own photos (camera or gallery) and a choice of the metrics they track. Everything is stored locally and survives restarts and app updates. The Sprint 0 design-review carry-over is closed along the way.

## Sprint demo criteria

1. In Expo Go on Android, open the **Exercises** tab, type "squat" in the search field: matching exercises (e.g. "Barbell Squat") appear while typing. Open one: its details and **images** are shown, and the gallery can be swiped.
2. Combine a filter (e.g. muscle "Quadriceps" + equipment "Barbell") with a search; the list and the result count update; "Clear filters" restores the full list.
3. Create your own exercise ("My Goblet Squat", category, muscles, instructions, tracked metrics "Weight" + "Reps") with **your own equipment value** "Sandbag" added from the form, and attach **a photo** from the camera or the gallery. It appears in the list and in search results, and "Sandbag" appears in the equipment filter.
4. Close the app completely and reopen it: the custom exercise and its photo are still there. Edit it, then delete it: it disappears from the list.
5. The same works in the **release APK** from the Sprint 0.5 pipeline (installed from a GitHub Release, or updated in-app from the previous build without losing data).
6. With the phone offline, the library, search, filters and the detail text still work; images that were viewed before are still shown; images never viewed show a placeholder.
7. Online, start **"Download all images for offline use"**: the app shows the estimated size and count and asks for confirmation, then shows progress ("n of total") while the app stays usable; cancel it, start it again (already downloaded images are skipped), let it finish, then go offline: every built-in image is shown.

Also shown at the review:
- the Maestro flow for this journey (S1-25) and its result on a device;
- `npx tsc --noEmit`, `npm run lint`, `npm test -- --coverage` results (real output), Stryker result for `exercises/domain`;
- ADR-004 (S1-27) and the data attribution in Settings (S1-24).

## Conventions used in this file

- **Module** says where the story lives: `exercises` (new code in all four layers), `shared` (kernel, UI, infrastructure), `core` (shell, DI, bootstrap), `settings`, `tooling`, `docs`, `e2e`. Layer in brackets.
- **Owner** is the agent that implements the story. Two owners means core-dev does domain/application/infrastructure and ui-dev does presentation, on separate files.
- Each acceptance criterion (AC) is written as Given/When/Then so it can become a test **before** implementation (outside-in: use-case or screen test first, then unit tests). ACs marked **(device)** are checked by QA on a phone (S1-26) because they cannot run in Jest.
- **"Built-in"** = an exercise seeded from free-exercise-db. **"Custom"** = an exercise created by the user. **"Active"** = not deleted (see S1-21).
- **Vocabularies** (categories, muscles, equipment) consist of the **built-in values** of the pinned dataset version (S1-11) plus **user-defined values** created from the custom-exercise form (decision Q5, S1-29). Level (and force/mechanic) are built-in only and not user-extensible. The exact built-in lists are recorded by the architect in the Interfaces section.
- **Name comparison** ("same name") always means: after trimming and collapsing inner whitespace, compared case- and accent-insensitively (Unicode NFD with combining marks removed). One domain function does this for exercise names and vocabulary values alike (DRY).
- **Tracked metrics** are `weight`, `reps`, `time`, `distance`, `rpe` (PLAN §1 "Metrics logged"). Adding a metric later must be an extension (new registration), not an edit across the code.
- Names of ports, tables, files, libraries and caching mechanisms are architect decisions unless an AC states them. Example error codes in ACs (`exercises.nameRequired`, …) are proposals; the architect fixes the final list.
- "The reference phone" is the user's Android phone used for S05-14 and S1-26.

---

## Stories

### A. Carry-over and shared foundations

#### S1-01 — Normalise `-0` in unit value objects (Sprint 0 bug Q-1)
**Module:** shared (domain) · **Owner:** core-dev
- **Given** `createWeight(-0, 'kg')`, `durationFromSeconds(-0)` or `createDistance(-0, 'km')`, **When** the value is read back in any unit, **Then** `Object.is(value, 0)` is `true` (never `-0`).
- **Given** any finite input `x ≥ 0` (fast-check), **When** a factory creates a value, **Then** reading it back never returns `-0`, and every other existing behaviour (full precision, round-trips) is unchanged.
- **Given** the fix, **When** the tests run, **Then** they were written first and seen failing for `-0`; domain coverage stays 100%.

#### S1-02 — Logger contract, or a documented exception (Sprint 0 finding Q-3)
**Module:** test (contracts), shared (application/infrastructure) · **Owner:** architect
- **Given** `test/fakes/README.md` says every fake passes its port's contract suite, **When** the work is done, **Then** either a minimal `Logger` contract suite in `test/contracts/` runs against both `RecordingLogger` and `ConsoleLogger` (with `console` stubbed at the boundary), **or** the README states the Logger exception and why, and the two no longer disagree.
- **Given** the chosen option, **When** ADR-001 or the README is read, **Then** the decision is recorded in one sentence.

#### S1-03 — Split `boundaries.test.ts` by concern
**Module:** tooling · **Owner:** architect
- **Given** `tooling/eslint/boundaries.test.ts` (349 lines), **When** it is split, **Then** each resulting file is ≤ 250 lines and groups one concern (e.g. layers, modules, external packages, test files).
- **Given** the split, **When** the tooling tests run, **Then** the number of test cases is the same or higher and no assertion was removed (QA compares the case lists before/after).

#### S1-04 — First module schema; migrations come from the drizzle-kit bundle
**Module:** exercises (infrastructure), shared (infrastructure) · **Owner:** core-dev
- **Given** the first `*.schema.ts` file (the exercises tables), **When** `npm run db:generate` runs, **Then** a versioned migration and the generated index are written to `src/shared/infrastructure/db/migrations/`, and `APP_MIGRATIONS` is built with `migrationsFromDrizzleKit(generatedBundle)` instead of the hand-written list.
- **Given** a fresh database, **When** the app's migrations run, **Then** every exercises table exists and the recorded schema version equals the number of generated migrations.
- **Given** a database created by the Sprint 0.5 build (schema version table only, no exercises tables), **When** the Sprint 1 build starts, **Then** the migration applies in one transaction and startup succeeds (migration test against a database in that state).
- **Given** a migration that fails, **When** startup runs, **Then** it is rolled back and the existing startup failure screen (S0-17) is shown with `db.migrationFailed` (existing behaviour, re-tested with the real bundle).
- **Given** the composition-root test, **When** it runs, **Then** it constructs the real migrator with the generated bundle, so a broken bundle fails CI.

#### S1-05 — Tab bar icons
**Module:** core (presentation) · **Owner:** ui-dev
- **Given** the tab bar, **When** it renders, **Then** each of the five tabs shows an icon next to its label, from `@expo/vector-icons` (works in Expo Go).
- **Given** a screen reader, **When** it reads a tab, **Then** the accessibility label is still the tab name only ("Exercises"), the icon is not announced separately, and the existing tab tests still pass.
- **Given** the selected tab, **When** it renders, **Then** its icon uses the theme's active colour token and the others the inactive token (RNTL test on the style token, not a snapshot).

#### S1-06 — Shared `Button` in the design system (Sprint 0.5 close-out B05-1)
**Module:** shared (ui), updates (presentation) · **Owner:** ui-dev
- **Given** `PromptButton` in `updates/presentation`, **When** the first Sprint 1 form needs a button, **Then** it is promoted to `shared/ui` as `Button` (primary / secondary / destructive variants), `MIN_TOUCH_TARGET_SIZE` and `PRESSED_OPACITY` become theme tokens, and the update prompt uses the shared `Button`.
- **Given** a `Button`, **When** it is disabled, **Then** it cannot be pressed, is announced as disabled (`accessibilityState.disabled`), and its touch target is at least the minimum size token.
- **Given** the update prompt tests (S05-08 to S05-10), **When** they run after the move, **Then** they pass unchanged.

#### S1-07 — `ErrorState` announces itself when shown inline
**Module:** shared (ui) · **Owner:** ui-dev
- **Given** `ErrorState` used inside a screen (first inline use: the exercise list, S1-16), **When** it appears, **Then** it is announced to screen readers through `accessibilityLiveRegion` ("polite" or "assertive", ui-dev chooses and states why), proven by an RNTL test on the prop.
- **Given** `ErrorState` with a retry action, **When** it renders, **Then** the retry is a shared `Button` (S1-06) findable by its accessibility label "Retry".

### B. Exercise domain (pure rules)

#### S1-08 — Exercise entity and validation rules
**Module:** exercises (domain) · **Owner:** core-dev
As the user, I want my exercise data to be checked by one set of rules, so that the app never stores an exercise it cannot use later in routines and logging.

- **Given** valid input, **When** a custom exercise is created, **Then** the result is an immutable `Exercise` with: branded `ExerciseId`, name, category, primary muscles, secondary muscles, equipment, instructions (ordered list of steps), images, tracked metrics, origin `custom` (PLAN §3; `isCustom` is derived from the origin).
- **Given** a name that is empty or whitespace only after trimming, **When** it is validated, **Then** the result is `err` with `exercises.nameRequired`. **Given** a name longer than the maximum (proposed 80 characters after trimming), **Then** `err` `exercises.nameTooLong`. Leading/trailing whitespace is trimmed and inner runs of whitespace are collapsed to one space.
- **Given** no tracked metric, **When** validated, **Then** `err` `exercises.noTrackedMetric` ("at least one required"). Duplicate metrics are stored once; the order of metrics is the canonical order `weight, reps, time, distance, rpe` regardless of input order.
- **Given** a category, muscle or equipment value that is neither a built-in value nor an existing user-defined value of that vocabulary (S1-29), **When** validated, **Then** `err` with `exercises.unknownCategory` / `exercises.unknownMuscle` / `exercises.unknownEquipment`.
- **Given** two names, **When** the domain's name-comparison function compares them, **Then** "  Barbell   squat " and "barbell SQUAT" are equal, "Préss" and "press" are equal, and "Squat" and "Squats" are not (this function is reused by S1-09 search normalisation, S1-19/S1-20 uniqueness and S1-29 values). The uniqueness check itself needs the repository and lives in the application layer (S1-19).
- **Given** no primary muscle, **When** validated, **Then** `err` `exercises.primaryMuscleRequired` (assumption A3). **Given** a muscle listed both as primary and secondary, **Then** `err` `exercises.muscleListedTwice`.
- **Given** more photos than the maximum (assumption A5), **When** validated, **Then** `err` `exercises.tooManyPhotos`.
- **Given** several invalid fields at once, **When** validated, **Then** all field errors are returned together (so the form can show each next to its field), not only the first.
- **Given** an existing exercise and a change, **When** it is updated, **Then** a new instance is returned and the original is unchanged (immutability test); the id and origin never change.
- **Given** a built-in exercise, **When** any update or delete is attempted in the domain, **Then** the result is `err` `exercises.builtInReadOnly`.
- **Given** the domain, **When** coverage and Stryker run, **Then** coverage is 100% and the mutation score for `exercises/domain` is ≥ 80% (surviving mutants listed by QA).

#### S1-09 — Search, filter and sort (pure functions)
**Module:** exercises (domain or application, architect decides) · **Owner:** core-dev
As the user, I want search to find what I mean even if I type sloppily, so that I find "Squat" quickly among 800 exercises.

- **Given** the exercise "Barbell Squat", **When** I search "squat", "SQUAT", "squ" or "bar squ", **Then** it matches (case-insensitive, partial, every typed word must appear in the name in any order).
- **Given** a name with accents (e.g. a custom "Préss Fráncés"), **When** I search "press frances", **Then** it matches; and searching "préss" matches "Press" (accent-insensitive in both directions, Unicode NFD with combining marks removed).
- **Given** a query of only whitespace, **When** searching, **Then** it behaves like no query.
- **Given** filters for muscles, equipment and categories, **When** several values are chosen in one filter, **Then** an exercise matches if it has **any** of them (OR); **When** several filters are combined (with each other and with the search text), **Then** an exercise must match **all** of them (AND).
- **Given** a muscle filter, **When** it is applied, **Then** it matches the exercise's **primary** muscles (assumption A4).
- **Given** a user-defined value (e.g. equipment "Sandbag", S1-29), **When** it is used as a filter value, **Then** it behaves exactly like a built-in value (same OR/AND semantics).
- **Given** deleted (archived) exercises, **When** the library is searched or filtered, **Then** they never appear.
- **Given** any result, **When** it is sorted, **Then** it is alphabetical by name, case- and accent-insensitive, with ties broken by id so the order is stable (property test: sorting is idempotent and filtering never adds items).
- **Given** fast-check generated libraries and queries, **When** search and filter run, **Then** "results ⊆ library", "empty query and no filter = whole active library", and "adding a filter value to a facet never removes results; adding a facet never adds results" hold.

#### S1-10 — Default tracked metrics for built-in exercises
**Module:** exercises (domain) · **Owner:** core-dev
As the user, I want built-in exercises to come with sensible tracked metrics, so that later I can log a squat with weight and reps without setting anything up.

- **Given** a built-in exercise's category and equipment, **When** its tracked metrics are derived, **Then** the result follows the table below (decision Q3), implemented as a named strategy/rule table, not as `if` chains spread over the code:

  | Built-in exercise | Tracked metrics |
  |---|---|
  | category cardio | time, distance |
  | category stretching | time |
  | category plyometrics | reps |
  | strength / powerlifting / olympic weightlifting / strongman with equipment "body only" | reps |
  | strength / powerlifting / olympic weightlifting / strongman with any other equipment | weight, reps |
- **Given** any built-in exercise (fast-check over the vocabularies), **When** metrics are derived, **Then** at least one metric is returned (same rule as S1-08).
- **Given** RPE, **When** defaults are derived, **Then** RPE is never in any default (decision Q3; it is optional per set when logging, Sprint 3).
- **Given** a built-in whose category or equipment is not covered by the table (e.g. `null` equipment in the dataset), **When** metrics are derived, **Then** the rule for "any other equipment" of its category applies, and the table rows are tested one by one.

### C. Built-in library seed

#### S1-11 — Pin, convert and bundle the free-exercise-db dataset
**Module:** tooling, assets (`assets/exercise-db/`) · **Owner:** architect
As the user, I want the built-in library to be in the app, so that it works offline from the first launch.

- **Given** the upstream dataset, **When** it is added, **Then** a specific upstream version (commit) is pinned and recorded, with the number of exercises it contains (the plan says ~800; the exact count of the pinned version is recorded).
- **Given** the dataset's licence, **When** the architect checks it, **Then** ADR-004 records that the data **and the images** may be redistributed and used in the app (expected: Unlicense / public domain), with a link to the licence text, and a copy of the licence is stored next to the asset. If the images are not covered by the same licence, the architect **stops and reports** instead of shipping them.
- **Given** a conversion script in `tooling/`, **When** it runs on the upstream JSON, **Then** it produces the app's seed asset (stable source key per exercise, name, category, primary/secondary muscles, equipment, level, force, mechanic, instructions, image paths, seed version) and is developed test-first (fixtures for missing optional fields, `null` equipment, empty muscle lists, duplicate names, unknown vocabulary values → script fails with a clear message).
- **Given** the seed asset, **When** it is bundled, **Then** it contains no images (images are fetched on demand, S1-18), and its size is recorded in ADR-004.
- **Given** a later re-run of the script on a newer upstream version, **When** the asset changes, **Then** its seed version is strictly greater than before (checked by a test or by the script).

#### S1-12 — Idempotent, versioned seeding
**Module:** exercises (application, infrastructure) · **Owner:** core-dev
As the user, I want the built-in library to be installed once and updated safely, so that I never see duplicates and never lose my own exercises.

- **Given** a fresh install, **When** seeding runs, **Then** every exercise of the seed asset exists exactly once as a built-in, with tracked metrics from S1-10, and the stored seed version equals the asset's version.
- **Given** seeding has already completed for this seed version, **When** it runs again (second launch, or twice in a row), **Then** nothing is written and the library is identical (same ids, same row count).
- **Given** seeding was interrupted (app killed, error mid-way), **When** it runs again, **Then** it completes and no built-in exists twice (seeding is all-or-nothing, e.g. one transaction).
- **Given** a stored seed version lower than the asset's (a later app update), **When** seeding runs, **Then** existing built-ins are updated **in place** by their stable source key (their `ExerciseId` never changes, so future routines and history keep pointing at them), new ones are added, and built-ins no longer in the asset are archived (hidden), not deleted.
- **Given** custom exercises (with photos) exist, **When** any seed update runs, **Then** every custom exercise is unchanged in every field, and its photo files still exist (contract/integration test comparing before/after).
- **Given** a custom exercise whose name equals (S1-08 comparison) a built-in added or renamed by a seed update, **When** the update runs, **Then** seeding does **not** fail, the custom exercise is **not** renamed or changed, and both exist (decision Q6: the uniqueness rule applies only when the user creates or renames an exercise). The detail and list still tell them apart by the "Custom" badge.
- **Given** user-defined vocabulary values exist (S1-29), **When** any seed update runs, **Then** they all still exist and every custom exercise still refers to the same values.
- **Given** a seed update introduces a built-in value equal to an existing user-defined value (e.g. the dataset adds "Sandbag"), **When** the update runs, **Then** no data is lost, no exercise changes its meaning, and the pickers and filters show the value **once** (how the two are merged is architect question T9).
- **Given** a stored seed version **higher** than the asset's (downgrade, branch switch), **When** seeding runs, **Then** nothing is changed.
- **Given** the seeding use case, **When** it is tested, **Then** it runs against in-memory fakes of its ports; the SQLite adapter passes the same repository contract suite (S1-14).

#### S1-13 — Seed at startup without blocking it
**Module:** exercises (application), core (bootstrap, presentation) · **Owner:** core-dev + ui-dev
- **Given** a first launch, **When** the app starts, **Then** the tabs appear without a noticeable extra wait: either seeding finishes within **500 ms** extra on the reference phone (measured by QA, device), or the tabs appear first and the Exercises tab shows its loading state until seeding completes. The architect chooses and records which in ADR-004.
- **Given** a later launch with nothing to seed, **When** the app starts, **Then** startup time is not measurably different from the Sprint 0.5 build (device; QA reports both times).
- **Given** seeding fails (e.g. a corrupt asset or a write error), **When** the app starts, **Then** the app still starts and the other tabs work, the failure is logged through `Logger` with its error code, and the Exercises tab shows an error state with **Retry** that runs seeding again.
- **Given** custom exercises exist and seeding fails, **When** the Exercises tab opens, **Then** the error state is shown (assumption A9: no partial library in Sprint 1) and no data is lost.

### D. Browse, search and detail

#### S1-14 — Exercise repository (ports, SQLite adapter, contract suite)
**Module:** exercises (application, infrastructure) · **Owner:** core-dev
- **Given** the exercise ports (reader/writer split if consumers differ, architect decides), **When** the contract suite runs, **Then** the in-memory fake and the SQLite adapter pass the **same** suite (Liskov) on a fresh `:memory:` database per test.
- **Given** an exercise is saved and read back, **When** it is compared, **Then** every field round-trips exactly (lists keep their order, instructions keep their steps, tracked metrics keep the canonical order), through explicit row ⇄ domain mappers.
- **Given** an archived (deleted) exercise, **When** the library is listed, **Then** it is excluded; **When** it is read by id with "include archived", **Then** it is returned and marked archived (needed by routines/history in later sprints).
- **Given** ~900 exercises in the SQLite adapter (test fixture generated from the builder), **When** the library list is read, **Then** it returns a lightweight summary per exercise (id, name, category, primary muscles, equipment, cover image reference, origin) and the read takes well under the test-speed budget (no single test file > 2 s, ADR-001 §10).

#### S1-15 — Browse and find exercises (use cases)
**Module:** exercises (application) · **Owner:** core-dev
- **Given** the library and a query (text + filters), **When** the "find exercises" use case runs, **Then** it returns the summaries matching S1-09, in S1-09's order, plus the total count.
- **Given** the "get exercise" use case and an existing active id, **When** it runs, **Then** it returns the full exercise; **Given** an unknown or archived id, **Then** `err` `exercises.notFound`.
- **Given** the "list filter options" use case, **When** it runs, **Then** it returns each vocabulary (categories, muscles, equipment) with display labels, built-in **and** user-defined values together (S1-29), each value once, in a stable alphabetical order (case- and accent-insensitive).
- **Given** a repository failure, **When** any of these use cases runs, **Then** it returns `err` (never throws) and the failure is logged.
- **Given** the use cases, **When** they are tested, **Then** only in-memory fakes are used; application coverage 100% lines / ≥ 95% branches.

#### S1-16 — Exercise library screen: list, search, filters, states
**Module:** exercises (presentation), app · **Owner:** ui-dev
As the user, I want to scroll, search and filter the library on the Exercises tab, so that I can find an exercise in seconds.

- **Given** the Exercises tab, **When** the library has loaded, **Then** a list shows each exercise's name, category and primary muscles, a thumbnail (S1-18, decision Q4) and a "Custom" badge for custom exercises; the "Coming soon" placeholder is gone.
- **Given** the search field (accessibility label "Search exercises"), **When** I type, **Then** the list updates while typing (debounced; results within 300 ms of the last keystroke on the reference phone, device) using the use case, never a re-implementation of the matching rules in the UI.
- **Given** filter controls for **Muscle**, **Equipment** and **Category**, **When** I pick values, **Then** the list shows only matching exercises (S1-09 semantics), the active filters are visible, a result count ("23 exercises") is shown, and **Clear filters** resets all filters (but not the search text).
- **Given** ~800+ exercises, **When** the list first renders, **Then** it is virtualised: far fewer rows than exercises are mounted (RNTL test asserts the mounted row count stays below a named constant), and on the reference phone a fast fling from top to bottom shows no freeze or crash (device; QA notes the Expo performance monitor's JS frame rate).
- **Given** loading (including first-launch seeding, S1-13), **When** the tab opens, **Then** a loading state is shown. **Given** a failure, **Then** the inline `ErrorState` with **Retry** is shown (S1-07). **Given** no results, **Then** an empty state "No exercises match" with **Clear filters** (if filters are active) is shown.
- **Given** a row, **When** I tap it, **Then** the exercise detail opens (S1-17). **Given** an **Add exercise** action on the screen, **When** I tap it, **Then** the create form opens (S1-19).
- **Given** I come back from detail or the form, **When** the list shows again, **Then** my search text, filters and scroll position are kept, and a created/edited/deleted exercise is reflected.
- **Given** the screen, **When** it is tested, **Then** behaviour is tested through a view-model hook and RNTL queries by accessibility label; presentation coverage ≥ 85%.

#### S1-17 — Exercise detail with image gallery
**Module:** exercises (presentation), app (stack route), core (presentation) · **Owner:** ui-dev
As the user, I want to see how an exercise is done, so that I perform it correctly.

- **Given** an exercise, **When** its detail opens (as a stack screen outside the tabs; the root layout becomes a `Stack` as planned in ADR-001 §13), **Then** it shows the name, category, equipment, primary and secondary muscles, the instructions as numbered steps, the tracked metrics, and for built-ins the level (and force/mechanic when present).
- **Given** an exercise with images, **When** the gallery shows, **Then** the images can be swiped horizontally, a position indicator ("1 / 2") is shown, and each image has an accessibility label (e.g. "Barbell Squat, image 1 of 2").
- **Given** an exercise with no images, **When** the detail opens, **Then** a neutral placeholder is shown instead of the gallery, without an error.
- **Given** a built-in exercise, **When** the detail opens, **Then** **Edit** and **Delete** are not offered, and **Duplicate as custom** is (S1-23, decision Q2). **Given** a custom exercise, **Then** **Edit** and **Delete** are offered.
- **Given** an unknown or archived id (e.g. a stale link), **When** the detail opens, **Then** an "Exercise not found" state with a way back is shown, no crash.
- **Given** the Android back button or the header back action, **When** pressed on the detail, **Then** I return to the list with my search and filters intact (S1-16).

#### S1-18 — Built-in images: fetched once, cached, defined offline behaviour
**Module:** exercises (application, infrastructure, presentation) · **Owner:** core-dev + ui-dev
As the user, I want exercise images to load once and then work offline, so that the library is useful in a gym without signal.

- **Given** a built-in image that has never been shown, **When** it is first displayed online, **Then** it is downloaded from the image location of the **pinned** dataset version (configuration, not strings scattered in code) and stored in a persistent cache.
- **Given** an image that was shown once, **When** the app is restarted offline (airplane mode), **Then** the image is shown from the cache (device; plus an adapter/contract test with the network stubbed as unavailable).
- **Given** an image never shown and no connection (or a failed download, e.g. HTTP 404), **When** it should be displayed, **Then** a placeholder with the accessibility label "Image not available offline" is shown, the rest of the screen works, and a later view online retries the download.
- **Given** the list thumbnails (decision Q4: on demand, on any connection), **When** rows scroll into view, **Then** only visible rows request images, the same cache as the detail is used, and a failed thumbnail shows the placeholder without affecting scrolling.
- **Given** the cache, **When** Android clears the app's cache directory, **Then** images are simply downloaded again when next shown online (no error, no broken references). Whether images live in a persistent app folder or in the image library's disk cache is decided in ADR-004.
- **Given** presentation code, **When** lint runs, **Then** no screen calls the network or the file system directly (existing boundary rules; image locations come through the application layer).
- **Given** images downloaded by the bulk action (S1-28) or on demand, **When** either path needs an image, **Then** both use the **same** cache, so an image is never downloaded twice.

### E. Custom exercises

#### S1-19 — Create a custom exercise
**Module:** exercises (all layers), app · **Owner:** core-dev (use case) + ui-dev (form)
As the user, I want to add my own exercise with the metrics I care about, so that I can use it in routines and logging later.

- **Given** the create form, **When** it opens, **Then** it has fields for name, category, primary muscles, secondary muscles, equipment, instructions (multi-line; one step per line, assumption A6), photos (S1-22) and tracked metrics (Weight, Reps, Time, Distance, RPE), each findable by accessibility label. No metric is preselected (assumption A7).
- **Given** valid input, **When** I tap **Save**, **Then** the exercise is stored as custom, the detail of the new exercise opens, and it appears in the list and in search results.
- **Given** invalid input, **When** I tap **Save**, **Then** nothing is stored and each problem is shown next to its field, with the messages mapped from the domain error codes of S1-08 (the form never re-implements the rules; a test proves that a domain-only rule change shows up in the form).
- **Given** the category, muscle and equipment pickers, **When** they open, **Then** they list built-in and user-defined values together, and each offers **Add your own** (S1-29).
- **Given** a name equal (S1-08 comparison) to **any built-in exercise** name or to **any active custom exercise** name, **When** I save, **Then** nothing is stored and `err` `exercises.duplicateName` is shown on the name field, naming the existing exercise (decision Q6: unique across all). Examples that are rejected when "Barbell Squat" is built-in: "barbell squat", "  Barbell  Squat ", "Bárbell Squat".
- **Given** a name equal only to an **archived** (deleted) custom exercise, **When** I save, **Then** it is accepted.
- **Given** the uniqueness rule, **When** it is tested, **Then** it is checked by the create/edit use cases against the repository (in-memory fake and SQLite pass the same "name taken" contract cases), using the single domain comparison function; the form never re-implements it.
- **Given** unsaved changes, **When** I leave the form (back button or Cancel), **Then** I am asked "Discard changes?"; confirming leaves without storing anything and removes photos copied for this form (S1-22).
- **Given** a saved custom exercise, **When** the app is closed completely and reopened, **Then** it is still there with all fields (device + SQLite integration test).
- **Given** the "create custom exercise" use case, **When** it is tested, **Then** it uses fakes for the repository, `IdGenerator` and `Clock` (if timestamps are stored), and returns `Result`.

#### S1-20 — Edit a custom exercise
**Module:** exercises (all layers) · **Owner:** core-dev + ui-dev
- **Given** a custom exercise, **When** I tap **Edit** on its detail, **Then** the form opens prefilled with all current values and photos.
- **Given** valid changes, **When** I save, **Then** the exercise keeps its id, the changes show in the detail and the list immediately and after a restart.
- **Given** invalid changes, **When** I save, **Then** nothing is changed and the errors are shown as in S1-19.
- **Given** I rename the exercise to a name taken by a built-in or another active custom exercise, **When** I save, **Then** `err` `exercises.duplicateName` as in S1-19. **Given** I keep its own name, or only change its case/accents/spacing (e.g. "my goblet squat" → "My Goblet Squat"), **Then** it is accepted (an exercise never collides with itself).
- **Given** a built-in id, **When** the "edit" use case is called directly (bypassing the UI), **Then** it returns `err` `exercises.builtInReadOnly` and nothing changes.
- **Given** the tracked metrics are changed, **When** saved, **Then** the change applies only to the exercise definition (no logs exist yet; Sprint 3/4 must keep past logs unchanged, noted in ADR-004 for forward compatibility).

#### S1-21 — Delete a custom exercise (archive, decision Q1)
**Module:** exercises (all layers) · **Owner:** core-dev + ui-dev
As the user, I want to remove exercises I no longer use, without breaking anything that refers to them later.

- **Given** a custom exercise, **When** I tap **Delete**, **Then** I am asked to confirm ("Delete 'My Goblet Squat'?"); **Cancel** changes nothing.
- **Given** I confirm, **When** the delete completes, **Then** I return to the list, and the exercise no longer appears in the list, in search, in filters, or by opening its detail ("Exercise not found").
- **Given** a deleted exercise, **When** it is read by id with "include archived" (repository contract, S1-14), **Then** it still exists, marked archived, with its name and tracked metrics (decision Q1: archive, so later routines and history stay readable).
- **Given** a deleted exercise had photos, **When** the delete completes, **Then** its photo files are removed from app storage right away (decision Q1).
- **Given** a built-in id, **When** the delete use case is called directly, **Then** `err` `exercises.builtInReadOnly` and nothing changes.
- **Given** Sprint 1 scope, **When** deletion happens, **Then** there is no undo or "restore deleted exercises" screen (out of scope), and the deleted exercise's name can be used again by a new custom exercise (decision Q6: archived exercises don't block a name).
- **Given** a deleted exercise used user-defined values (S1-29), **When** it is deleted, **Then** those values stay available in the pickers and filters.

#### S1-22 — Custom photos from camera or gallery, owned by the app
**Module:** exercises (all layers) · **Owner:** core-dev (ports, adapters, use cases) + ui-dev (form, permissions UX)
As the user, I want to attach my own photos, and keep them even if I clean up my phone's gallery.

- **Given** the form, **When** I tap **Add photo**, **Then** I can choose **Camera** or **Gallery**; both go through a port (no Expo picker or file-system calls in presentation, enforced by lint).
- **Given** I pick a photo from the gallery or take one, **When** it is added, **Then** a copy is stored in the app's own persistent storage, and the exercise refers only to the app-owned copy, never to the gallery/camera URI.
- **Given** a saved exercise with a photo, **When** the original is deleted from the phone's gallery and the app is restarted, **Then** the photo is still shown (device; plus an adapter test where the source file is removed after the copy).
- **Given** the picker is cancelled, **When** I return, **Then** nothing changes.
- **Given** camera permission is denied (or gallery access is denied), **When** I choose that source, **Then** a short message explains how to allow it in Android settings, the other source still works, and nothing crashes.
- **Given** the photo maximum (assumption A5) is reached, **When** the form shows, **Then** **Add photo** is disabled with a hint ("Up to 6 photos").
- **Given** I remove a photo in the form, **When** I **save**, **Then** its file is deleted; **When** I **discard** instead, **Then** the photo and its file are kept.
- **Given** photos added to a form that is then discarded, **When** I leave, **Then** their copied files are deleted.
- **Given** copying fails (e.g. storage full), **When** I add a photo, **Then** an error is shown, the rest of the form is kept, and no partial file remains.
- **Given** files in the custom-photo folder that no exercise refers to (e.g. after a crash mid-edit), **When** the app starts, **Then** they are removed in the background without delaying startup, and files referenced by any active exercise are never removed (contract test).
- **Given** a large camera photo, **When** it is stored, **Then** it is downscaled/compressed per assumption A8 so storage stays reasonable (architect sets the exact values).
- **Given** the photo store port, **When** its contract suite runs, **Then** the fake and the real adapter (native file-system boundary mocked) pass the same suite.

#### S1-23 — Duplicate a built-in exercise as custom (decision Q2)
**Module:** exercises (domain, application, presentation) · **Owner:** core-dev + ui-dev
As the user, I want to start from a built-in exercise and adjust it, since built-ins are read-only.

- **Given** a built-in exercise detail, **When** I tap **Duplicate as custom**, **Then** the create form opens prefilled with a free name (below), category, muscles, equipment, instructions and tracked metrics; nothing is stored until I save.
- **Given** the built-in "Barbell Squat" and no exercise named "Barbell Squat (custom)", **When** the name is prefilled, **Then** it is "Barbell Squat (custom)".
- **Given** "Barbell Squat (custom)" is already taken (by a built-in or an active custom exercise, S1-08 comparison), **When** the name is prefilled, **Then** it is "Barbell Squat (custom 2)"; if that is taken too, "(custom 3)", and so on: the first free number from 2 upwards (pure function, property test: the result never collides with the given set of taken names and stays within the name maximum, shortening the base name if needed).
- **Given** the prefilled name became taken before I save (or I edit it into a taken name), **When** I save, **Then** S1-19's `exercises.duplicateName` applies; nothing is stored silently under a colliding name.
- **Given** the duplicate is saved, **When** I look at the library, **Then** the built-in is unchanged and the new custom exercise exists separately with a new id.
- **Given** the built-in's images, **When** it is duplicated, **Then** they are **not** copied (assumption A10); I can add my own photos.

#### S1-28 — Download all built-in images for offline use (decision Q4)
**Module:** exercises (application, infrastructure, presentation), settings (presentation) · **Owner:** core-dev (use case, downloader, cache) + ui-dev (screen, progress UI)
As the user, I want to download every built-in image once while I'm on Wi-Fi, so that the whole library has images in a gym without signal.

Placement (proposed, architect confirms in Phase 1, T8): the action lives in **Settings → "Offline images"**, and the Exercises tab offers a small link to it (e.g. in the placeholder text "Image not available offline – download all images in Settings"). The download itself belongs to the `exercises` module; Settings only renders the `exercises` public presentation component.

- **Given** the app, **When** it starts or the library is browsed, **Then** a bulk download **never starts by itself**; it starts only when I tap **Download all images**.
- **Given** I tap **Download all images**, **When** the confirmation shows, **Then** it states how many images are still missing and their estimated total size (e.g. "1 746 images, about 99 MB. Use Wi-Fi if you can."; corrected by the architect from the pinned dataset), with **Download** and **Cancel**; nothing is downloaded before I confirm. The estimate comes from the seed metadata or a named per-image average constant (architect decides), and is labelled as an estimate.
- **Given** every image is already cached, **When** I open the action, **Then** it says "All images are available offline" and offers no download.
- **Given** the download runs, **When** images complete, **Then** progress shows "n of total" (and a progress bar with an accessibility label such as "Image download progress, 250 of 1 512"), updating as images arrive.
- **Given** the download runs, **When** I use the rest of the app (browse, search, open details, create exercises, switch tabs), **Then** it keeps working normally; the download does not block the UI or startup.
- **Given** the download runs, **When** I tap **Cancel download**, **Then** it stops promptly, images already downloaded stay cached, and no partial image file remains or is ever shown as an image.
- **Given** some images are already cached (earlier views, a cancelled or interrupted run), **When** I start the download again, **Then** cached images are skipped (not downloaded again), the count and estimate cover only the missing ones, and running it twice in a row downloads nothing the second time (idempotent).
- **Given** some images fail (HTTP error, timeout, connection lost), **When** the run ends, **Then** a summary says how many succeeded and how many failed, with **Retry failed** that downloads only the failed ones; failures are logged with their error code. A lost connection ends the run with this summary instead of retrying forever.
- **Given** the run is in progress, **When** I leave the screen, **Then** the download continues while the app is open, and coming back shows the current progress. **When** the app is sent to the background or closed, **Then** images downloaded so far are kept (progress is never lost for completed images); whether the run continues in the background or stops and is resumed by the user is decided by the architect (T8) and stated in the UI and ADR-004.
- **Given** a second tap on **Download all images** while a run is active, **When** it happens, **Then** no second run starts (one run at a time).
- **Given** the use case, **When** it is tested, **Then** it uses fakes for the image cache and downloader (progress, success, per-image failure, cancellation, already-cached), with a bounded concurrency the architect sets; the real adapter passes the same image-cache contract suite as S1-18.

#### S1-29 — User-defined categories, muscles and equipment (decision Q5)
**Module:** exercises (domain, application, infrastructure, presentation) · **Owner:** core-dev + ui-dev
As the user, I want to add my own values (e.g. equipment "Sandbag", a muscle, a category) when the built-in lists don't have what I need.

- **Given** the category, muscle or equipment picker in the custom-exercise form, **When** I tap **Add your own**, enter a value and confirm, **Then** the value is selected for this exercise and becomes available in that vocabulary.
- **Given** a new value, **When** it is validated in the domain, **Then** it is trimmed with inner whitespace collapsed; empty or whitespace-only → `err` `exercises.vocabularyValueRequired`; longer than the maximum (proposed 40 characters) → `err` `exercises.vocabularyValueTooLong`.
- **Given** a new value equal (S1-08 comparison) to a **built-in** value of the same vocabulary (e.g. "barbell", "Bárbell"), **When** I add it, **Then** no new value is created and the built-in value is selected instead.
- **Given** a new value equal to an **existing user-defined** value of the same vocabulary, **When** I add it, **Then** no duplicate is created and the existing value is selected.
- **Given** the same text in two different vocabularies (e.g. "Core" as a muscle and as a category), **When** both are added, **Then** both exist; vocabularies are independent.
- **Given** I add a value in the form and then **discard** the form, **When** I leave, **Then** the value is not persisted (it is saved together with the exercise; the architect may choose otherwise in T7 if it keeps this AC observable: a discarded form leaves no new value in pickers or filters).
- **Given** a saved user-defined value, **When** the app is restarted, **Then** it is still there, appears in the pickers of every custom-exercise form and in the library filters (S1-15/S1-16) next to the built-in values, alphabetically, and is marked as your own (e.g. a small "Custom" hint, ui-dev decides) only where it helps.
- **Given** a dataset re-seed (S1-12), **When** it runs, **Then** every user-defined value survives unchanged and keeps its exercises.
- **Given** a user-defined value no longer used by any active exercise (its exercises were edited or deleted), **When** the pickers and filters show, **Then** the value **stays** available (filtering by it shows the empty state); renaming, merging or deleting your own values is out of scope for Sprint 1 (Deferred).
- **Given** built-in values, **When** I look at the pickers, **Then** they cannot be renamed or removed.
- **Given** the vocabulary ports, **When** their contract suite runs, **Then** the in-memory fake and the SQLite adapter pass the same suite (create, reuse built-in, reuse existing, list in order, survives re-seed).

### F. Attribution, documentation, verification

#### S1-24 — Data attribution in Settings
**Module:** settings (presentation) · **Owner:** ui-dev
- **Given** the Settings tab, **When** it opens, **Then** a "Credits" section shows "Exercise data and images: free-exercise-db" with the project's link and its licence name as recorded in ADR-004 (expected: "public domain (Unlicense)"), findable by accessibility label "Exercise data credits".
- **Given** the credits text, **When** it is rendered, **Then** the dataset name, link and licence come from one constant/config next to the seed asset metadata, not duplicated strings.
- **Given** the existing Settings content (app version, S05-11), **When** the screen renders, **Then** it is unchanged.

#### S1-25 — Maestro flow for the demo journey; first device run of the smoke flow
**Module:** e2e · **Owner:** qa-engineer (ui-dev adds `testID`s if needed)
- **Given** the existing smoke flow, **When** Sprint 1 lands, **Then** it no longer expects "Coming soon" on the Exercises tab and still passes.
- **Given** a new flow `e2e/flows/exercise-library.yaml`, **When** it runs in Expo Go on a device or emulator, **Then** it: opens Exercises, searches "squat", opens a squat exercise, asserts the gallery and its position indicator are visible and swipes to the second image; creates "My Goblet Squat" with a category, a primary muscle, a new equipment "Sandbag" added from the form (S1-29), the metrics Weight + Reps and one photo (from the gallery; the flow seeds the gallery itself, e.g. with Maestro's `addMedia`); asserts it appears in search; restarts the app and asserts it is still there; deletes it and asserts it is gone.
- **Given** the smoke flow had never run on a device (Sprint 0 risk Q-5), **When** QA runs both flows on the reference phone or an emulator, **Then** the results are reported; if accessibility labels are not visible to Maestro, ui-dev adds `testID`s (e.g. on `Screen`) test-first and the flows use them.

#### S1-26 — On-device verification (Expo Go and release APK), including the pending Sprint 0.5 S05-14
**Module:** tooling (manual checklist) · **Owner:** qa-engineer
- **Given** the reference phone, **When** QA runs the checklist (written in Phase 3, run by the user), **Then** it covers: demo criteria 1–7; first-launch and second-launch startup times (S1-13); list fling smoothness (S1-16); images offline after one view, placeholder for never-viewed images (S1-18); bulk image download with confirm, progress, cancel, resume, airplane mode mid-run and leaving the screen/app (S1-28); a user-defined value surviving a restart and showing in filters (S1-29); camera and gallery photo, permission denial, original deleted from gallery (S1-22); restart persistence.
- **Given** Sprint 0.5's S05-14 on-device update verification has not been run yet (the first real CI release run succeeded on 2026-11-16), **When** the S1-26 checklist is run, **Then** it includes the sprint-0.5 checklist steps 2–8 (in-app update from build N to N+1, Later, cancel, network cut, install, offline start, Expo Go), and S05-14 is marked done in `BACKLOG.md` only when they pass.
- **Given** the Sprint 0.5 release build is installed and has been opened once, **When** the Sprint 1 build is installed over it through the in-app updater, **Then** the migration runs, the library is seeded, and the app starts without the failure screen.
- **Given** the results, **When** the QA report is written, **Then** it lists phone model, Android version, build numbers, measured times and every failed step.

#### S1-27 — ADR-004: Exercise library
**Module:** docs · **Owner:** architect
- **Given** `docs/adr/004-exercise-library.md` (name chosen by the architect), **When** it is read, **Then** it records: the dataset version pinned and its licence check (data and images); the seed asset format and versioning; how seeding avoids blocking startup (S1-13); the built-in update policy (update in place by stable key, archive removed ones, never touch custom); image fetching and caching, offline behaviour and the bulk download (S1-28: placement, concurrency, background/close behaviour, size estimate); how user-defined vocabulary values are modelled, stored and merged with built-in ones (S1-29); the name-uniqueness rule and the re-seed name collision policy (Q6); custom photo storage, compression, cleanup of orphans; the delete/archive semantics and how later modules reference exercises by `ExerciseId`; the tables owned by `exercises`; new dependencies and whether each works in Expo Go.
- **Given** the patterns used (e.g. Repository + Data Mapper, Adapter for picker/file system/image cache, Strategy/rule table for default metrics, Specification-style predicates for filters if used), **When** the ADR is read, **Then** each is named with the problem it solves here.

---

## Work split

**Phase 1 — architect first (blocking, small).**
- Define the exercises domain types, ports, use-case signatures, error codes, vocabularies and DI tokens in the "Interfaces" section below, with type-only stub files (as in Sprint 0.5).
- Add every new dependency in one go so `package.json` has a single owner (expected: `expo-image`, `expo-image-picker`, `@expo/vector-icons`, and any image-manipulation package for A8), check each works in Expo Go and `npx expo-doctor` stays green.
- S1-11 (dataset pin, licence check, conversion script, seed asset), S1-02, S1-03, draft S1-27.

**Phase 2 — core-dev and ui-dev in parallel, on files that don't overlap** (exact paths fixed by the architect in Phase 1).

| Story | core-dev | ui-dev |
|---|---|---|
| S1-01 `-0` normalisation | all | — |
| S1-04 Schema + drizzle-kit bundle | all | — |
| S1-05 Tab icons | — | all |
| S1-06 Shared `Button` | — | all |
| S1-07 `ErrorState` live region | — | all |
| S1-08 Exercise entity + validation | all | — |
| S1-09 Search / filter / sort | all | — |
| S1-10 Default tracked metrics | all | — |
| S1-12 Seeding | all | — |
| S1-13 Non-blocking seed | use case, bootstrap wiring | loading / error UI on the tab |
| S1-14 Repository + contract suite | all | — |
| S1-15 Browse use cases | all | — |
| S1-16 Library screen | — | all |
| S1-17 Detail + gallery, root `Stack` | — | all |
| S1-18 Built-in images | image-location use case, cache adapter | thumbnails, gallery, placeholder |
| S1-19 Create | use case | form |
| S1-20 Edit | use case | form (edit mode) |
| S1-21 Delete (archive) | use case, photo cleanup | confirm dialog, navigation |
| S1-22 Custom photos | picker + photo-store ports/adapters, orphan cleanup | add/remove UI, permission messages |
| S1-23 Duplicate as custom | prefill use case (or mapper) | action + prefilled form |
| S1-24 Credits in Settings | credits constant next to seed metadata (or architect in S1-11) | Settings section |
| S1-28 Download all images | bulk-download use case, cache/downloader adapter | offline-images component (exported by `exercises`), Settings section, link from Exercises |
| S1-29 User-defined values | value validation, vocabulary ports, repository, use cases | "Add your own" in pickers, filters show own values |

**Order inside Phase 2.** core-dev's **first** deliverable unblocks ui-dev: the `Exercise` / summary types with their factories and the builders `anExercise()`, `aCustomExercise()`, `aBuiltInExercise()`, `anExerciseSummary()` in `test/builders/`, plus fakes for the browse use cases. Until then, ui-dev does S1-05, S1-06, S1-07 and the presentational list/detail components with plain view props.

**Phase 3 — qa-engineer.** Verify every AC, run `npx tsc --noEmit`, `npm run lint`, `npm test -- --coverage`, `npx expo-doctor`, Stryker on `exercises/domain` (≥ 80%), S1-25 flows, write the S1-26 checklist and check one real release run.

**Architect closes** with ADR-004 finalised and a design review of all stories.

---

## Interfaces (architect, Phase 1 — stable contract for Phase 2)

The contract files below **already exist** (types, ports, use-case types and DI tokens only; tokens are tested in `src/modules/exercises/application/ports.test.ts`). Phase 2 adds implementations **next to** them, test-first; the "Phase 2:" TSDoc paragraph in each file names what goes there. Changing an existing signature is an architect decision: ask first, don't edit it silently. Design rationale: ADR-004 (Proposed).

### Folder layout per layer

| Path | Layer | Exists now (architect) | Phase 2 adds (owner) |
|---|---|---|---|
| `src/modules/exercises/domain/exercise.ts` | domain | `Exercise` = `BuiltInExercise \| CustomExercise`, `BuiltInExerciseData`, `ExerciseImage` = `BuiltInImage \| CustomPhoto`, `SeedSourceKey`, `DatasetImagePath`, `PhotoFileName`, `ExerciseOrigin`, `ExerciseLevel`, `ExerciseForce`, `ExerciseMechanic` | `isCustomExercise`, `parseSeedSourceKey`, `parseDatasetImagePath`, `parsePhotoFileName`, `createCustomExercise`, `updateCustomExercise`, `archiveExercise`, `createBuiltInExercise` (core-dev) |
| `…/domain/comparison-key.ts` | domain | `ComparisonKey` | `normaliseDisplayText`, `comparisonKey` (core-dev, **first deliverable**) |
| `…/domain/vocabulary.ts` | domain | `VocabularyKind`, `VocabularyKey`, `VocabularyOrigin`, `VocabularyValue`, `Vocabulary`, `VocabularySelection`, `ResolvedVocabularyValue` | `VOCABULARY_VALUE_MAX_LENGTH`, `mergeVocabulary`, `resolveVocabularySelection` (core-dev) |
| `…/domain/tracked-metric.ts` | domain | `TrackedMetric` | `TRACKED_METRICS` registry, `normaliseTrackedMetrics` (core-dev) |
| `…/domain/exercise-draft.ts` | domain | `ExerciseDraft`, `ValidatedExerciseDraft` | `EXERCISE_LIMITS`, `parseInstructions`, `formatInstructions`, `validateExerciseDraft` (core-dev) |
| `…/domain/exercise-errors.ts` | domain | `ExerciseField`, `ExerciseFieldErrorCode`, `ExerciseFieldIssue`, `ExerciseValidationError`, `VocabularyValueError`, `BuiltInReadOnlyError`, `ExerciseNotFoundError`, `InvalidExerciseDataError` | — |
| `…/domain/exercise-summary.ts` | domain | `ExerciseSummary` | — |
| `…/domain/exercise-query.ts` | domain | `ExerciseQuery` | facet specifications + `findMatchingExercises` (core-dev, S1-09) |
| `…/domain/library-seed.ts` | domain | `LibrarySeedPlan` | `planLibrarySeed` (core-dev, S1-12) |
| `…/domain/` (new files) | domain | — | `default-tracked-metrics.ts` (`DEFAULT_METRIC_RULES`, `defaultTrackedMetrics`, S1-10), `duplicate-name.ts` (`suggestDuplicateName`, S1-23) (core-dev) |
| `…/application/exercise-repository.ts` | application | `ExerciseReader`, `ExerciseWriter`, `VocabularyReader`, `BuiltInImageCatalog` (+ tokens), `ExerciseStorageError`, `FindExerciseOptions` | — |
| `…/application/library-seed-ports.ts` | application | `ExerciseSeedSource`, `BuiltInLibraryStore` (+ tokens), `SeedManifest`, `DatasetSource`, `SeedDataset`, `SeedSourceError` | — |
| `…/application/built-in-image-cache.ts` | application | `BuiltInImageCache` (+ token), `ImageDownloadTask`, `ImageDownloadError(Code)` | `single-flight-image-cache.ts` (Decorator, core-dev) |
| `…/application/photo-ports.ts` | application | `PhotoPicker`, `PhotoStore` (+ tokens), `PhotoSource`, `PickedPhoto`, `PhotoPickerError(Code)`, `PhotoStoreError(Code)` | — |
| `…/application/exercise-dtos.ts` | application | `VocabularyOption(s)`, `ExerciseImageRef`, `ExerciseSearchQuery`, `ExerciseListItem`, `BuiltInAttributes`, `ExerciseDetails`, `PhotoView`, `ExerciseFormValues`, `ExerciseInput`, `ResolvedVocabularyOption`, `ImageSource` | mappers domain → DTO (new file, core-dev) |
| `…/application/library-errors.ts`, `save-exercise-errors.ts` | application | `LibrarySeedError`, `ExerciseLibraryError`, `ExerciseLookupError`, `SaveExerciseError`, `DeleteExerciseError` | — |
| `…/application/<use-case>.ts` (14 files) | application | use-case function type + token each (list below) | `create<UseCase>(deps)` factory in the same file (core-dev) |
| `…/application/offline-images.ts` | application | `OfflineImages` service + token, `OfflineImagesEstimate`, `OfflineImagesState` | `createOfflineImages`, `OFFLINE_IMAGES_CONCURRENCY = 4`, `CONSECUTIVE_FAILURES_TO_STOP = 5` (core-dev) |
| `…/application/data-credits.ts` | application | `ExerciseDataCredits` + token | — (registered from the manifest) |
| `src/modules/exercises/infrastructure/` | infrastructure | empty | `exercises.schema.ts`, SQLite adapters + row mappers, `asset-exercise-seed-source.ts`, `expo-file-system-image-cache.ts`, `expo-photo-picker.ts`, `expo-photo-store.ts`, `exercise-image-config.ts` (core-dev) |
| `src/modules/exercises/presentation/` | presentation | Sprint 0 placeholder screen | library screen, detail + gallery, form, image component, offline-images section, view models (ui-dev) |
| `src/modules/exercises/index.ts` | public API | every domain/application type, port, use case and token above; `ExercisesScreen` | core-dev: domain function exports (domain section only); ui-dev: presentation exports (presentation section only) |
| `src/core/bootstrap/startup-task.ts` | core | `StartupTask` | `bootstrapper.ts` runs them after a successful startup (core-dev) |
| `tooling/exercise-db/**`, `assets/exercise-db/**` | tooling, asset | converter (S1-11, done), seed asset, manifest, licence copy | — |

### Exact signatures (as in the files; the files and their TSDoc are authoritative)

```ts
// ---- domain ----
type ComparisonKey = Brand<string, 'ComparisonKey'>;
type VocabularyKind = 'category' | 'muscle' | 'equipment';
type VocabularyKey = ComparisonKey;
type VocabularyOrigin = 'builtIn' | 'custom';
interface VocabularyValue { kind: VocabularyKind; key: VocabularyKey; label: string; origin: VocabularyOrigin }
type Vocabulary = Readonly<Record<VocabularyKind, readonly VocabularyValue[]>>;
type VocabularySelection = { source: 'existing'; key: VocabularyKey } | { source: 'new'; label: string };
interface ResolvedVocabularyValue { value: VocabularyValue; isNew: boolean }
type TrackedMetric = 'weight' | 'reps' | 'time' | 'distance' | 'rpe';
type SeedSourceKey = Brand<string, 'SeedSourceKey'>;
type DatasetImagePath = Brand<string, 'DatasetImagePath'>;   // "Barbell_Squat/0.jpg"
type PhotoFileName = Brand<string, 'PhotoFileName'>;         // "<id>.jpg"
interface BuiltInImage { kind: 'builtIn'; path: DatasetImagePath; sizeBytes: number }
interface CustomPhoto { kind: 'photo'; fileName: PhotoFileName }
type ExerciseImage = BuiltInImage | CustomPhoto;
// common: id: ExerciseId; name; category: VocabularyKey; primaryMuscles/secondaryMuscles: VocabularyKey[];
//         equipment: VocabularyKey | null; instructions: string[]; trackedMetrics: TrackedMetric[]; archived: boolean
interface BuiltInExercise { origin: 'builtIn'; sourceKey; level; force | null; mechanic | null; images: BuiltInImage[]; …common }
interface CustomExercise { origin: 'custom'; images: CustomPhoto[]; …common }
type Exercise = BuiltInExercise | CustomExercise;
interface BuiltInExerciseData { sourceKey; name; category; primaryMuscles; secondaryMuscles; equipment; level; force; mechanic; instructions; images }
interface ExerciseDraft { name: string; category: VocabularySelection | null; primaryMuscles: VocabularySelection[];
  secondaryMuscles: VocabularySelection[]; equipment: VocabularySelection | null; instructionsText: string;
  photos: PhotoFileName[]; trackedMetrics: TrackedMetric[] }
interface ValidatedExerciseDraft { name; category: VocabularyKey; primaryMuscles; secondaryMuscles; equipment;
  instructions: string[]; images: CustomPhoto[]; trackedMetrics; newVocabularyValues: VocabularyValue[] }
interface ExerciseFieldIssue { field: ExerciseField; code: ExerciseFieldErrorCode; message: string; details?: Record<string, unknown> }
interface ExerciseValidationError extends DomainError<'exercises.invalidExercise'> { issues: readonly ExerciseFieldIssue[] }
interface ExerciseSummary { id; name; origin; category; primaryMuscles; equipment; coverImage: ExerciseImage | null }
interface ExerciseQuery { text: string; muscles: VocabularyKey[]; equipment: VocabularyKey[]; categories: VocabularyKey[] }
interface LibrarySeedPlan { seedVersion: number; insert: BuiltInExercise[]; update: BuiltInExercise[]; archive: ExerciseId[]; vocabulary: VocabularyValue[] }
// Phase 2 domain functions (core-dev):
// normaliseDisplayText(raw: string): string;  comparisonKey(raw: string): ComparisonKey
// TRACKED_METRICS: readonly TrackedMetric[];  normaliseTrackedMetrics(metrics): readonly TrackedMetric[]
// VOCABULARY_VALUE_MAX_LENGTH = 40;  mergeVocabulary(values): Vocabulary
// resolveVocabularySelection(vocabulary, kind, selection): Result<ResolvedVocabularyValue, VocabularyValueError | DomainError<'exercises.unknownCategory'|'exercises.unknownMuscle'|'exercises.unknownEquipment'>>
// EXERCISE_LIMITS = { nameMaxLength: 80, instructionsMaxLength: 5_000, photosMax: 6 }
// parseInstructions(text): readonly string[];  formatInstructions(steps): string
// validateExerciseDraft(draft, vocabulary): Result<ValidatedExerciseDraft, ExerciseValidationError>
// isCustomExercise(e): e is CustomExercise;  parseSeedSourceKey / parseDatasetImagePath / parsePhotoFileName(raw): Result<…, InvalidExerciseDataError>
// createCustomExercise(id, validated): CustomExercise;  updateCustomExercise(existing: Exercise, validated): Result<CustomExercise, BuiltInReadOnlyError>
// archiveExercise(existing: Exercise): Result<CustomExercise, BuiltInReadOnlyError>;  createBuiltInExercise(id, data): BuiltInExercise
// defaultTrackedMetrics(category: VocabularyKey, equipment: VocabularyKey | null): readonly TrackedMetric[]
// findMatchingExercises<T extends ExerciseSummary>(library: readonly T[], query: ExerciseQuery): readonly T[]
// suggestDuplicateName(name: string, takenKeys: ReadonlySet<ComparisonKey>): string
// planLibrarySeed(input: { seedVersion: number; existing: readonly BuiltInExercise[]; seed: readonly BuiltInExerciseData[]; newId: () => ExerciseId }): LibrarySeedPlan

// ---- application: ports (every method: never throws/rejects) ----
type ExerciseStorageError = DomainError<'exercises.storageFailed'>;
interface ExerciseReader {
  listActiveSummaries(): Promise<Result<readonly ExerciseSummary[], ExerciseStorageError>>;
  findById(id: ExerciseId, options?: { includeArchived: boolean }): Promise<Result<Exercise | null, ExerciseStorageError>>;
  findActiveByNameKey(nameKey: ComparisonKey, excluding?: ExerciseId): Promise<Result<ExerciseSummary | null, ExerciseStorageError>>;
  listActivePhotoFileNames(): Promise<Result<ReadonlySet<PhotoFileName>, ExerciseStorageError>>;
}
interface ExerciseWriter { saveCustom(exercise: CustomExercise, newVocabularyValues: readonly VocabularyValue[]): Promise<Result<void, ExerciseStorageError>> }
interface VocabularyReader { listValues(): Promise<Result<readonly VocabularyValue[], ExerciseStorageError>> }
interface BuiltInImageCatalog { listActiveBuiltInImages(): Promise<Result<readonly BuiltInImage[], ExerciseStorageError>> }
interface SeedManifest { seedVersion: number; source: DatasetSource; imageBaseUrl: string; counts: { exercises; images; imageBytes } }
interface DatasetSource { name; repositoryUrl; commit; licence: { name; url } }
interface SeedDataset { seedVersion: number; vocabulary: readonly VocabularyValue[]; exercises: readonly BuiltInExerciseData[] }
interface ExerciseSeedSource { readonly manifest: SeedManifest; loadDataset(): Promise<Result<SeedDataset, DomainError<'exercises.seedAssetInvalid'>>> }
interface BuiltInLibraryStore {
  readSeedVersion(): Promise<Result<number | null, ExerciseStorageError>>;
  listBuiltIns(): Promise<Result<readonly BuiltInExercise[], ExerciseStorageError>>;
  applySeed(plan: LibrarySeedPlan): Promise<Result<void, ExerciseStorageError>>;
}
interface ImageDownloadTask { readonly result: Promise<Result<string /* file:// */, ImageDownloadError>>; cancel(): void }
interface BuiltInImageCache {
  localUri(path: DatasetImagePath): Promise<string | null>;
  cachedPaths(): Promise<ReadonlySet<DatasetImagePath>>;
  download(path: DatasetImagePath): ImageDownloadTask;
}
type PhotoSource = 'camera' | 'library';
interface PickedPhoto { uri: string; width: number; height: number }
interface PhotoPicker { pick(source: PhotoSource): Promise<Result<PickedPhoto | null, PhotoPickerError>> }
interface PhotoStore {
  importPhoto(photo: PickedPhoto): Promise<Result<PhotoFileName, PhotoStoreError>>;
  localUri(fileName: PhotoFileName): Promise<string | null>;
  deletePhotos(fileNames: readonly PhotoFileName[]): Promise<Result<void, PhotoStoreError>>;
  listPhotos(): Promise<Result<readonly PhotoFileName[], PhotoStoreError>>;
}

// ---- application: use cases and services (each never rejects) ----
type LibrarySeedError = DomainError<'exercises.seedAssetInvalid' | 'exercises.seedFailed'>;
type ExerciseLibraryError = LibrarySeedError | ExerciseStorageError;
type ExerciseLookupError = ExerciseLibraryError | ExerciseNotFoundError;
type SaveExerciseError = ExerciseValidationError | ExerciseNotFoundError | BuiltInReadOnlyError | ExerciseLibraryError;
type DeleteExerciseError = ExerciseNotFoundError | BuiltInReadOnlyError | ExerciseLibraryError;
type EnsureLibrarySeeded = () => Promise<Result<LibrarySeedReport, LibrarySeedError>>;   // memoized, retry after failure
type FindExercises = (query: ExerciseSearchQuery) => Promise<Result<readonly ExerciseListItem[], ExerciseLibraryError>>;
type GetExerciseDetails = (id: ExerciseId) => Promise<Result<ExerciseDetails, ExerciseLookupError>>;
type ListVocabularyOptions = () => Promise<Result<VocabularyOptions, ExerciseLibraryError>>;
type ResolveVocabularyValue = (kind: VocabularyKind, label: string) => Promise<Result<ResolvedVocabularyOption, VocabularyValueError | ExerciseLibraryError>>;
type CreateCustomExercise = (input: ExerciseInput) => Promise<Result<ExerciseId, SaveExerciseError>>;
type UpdateCustomExercise = (id: ExerciseId, input: ExerciseInput) => Promise<Result<void, SaveExerciseError>>;
type DeleteCustomExercise = (id: ExerciseId) => Promise<Result<void, DeleteExerciseError>>;
type GetExerciseFormValues = (id: ExerciseId) => Promise<Result<ExerciseFormValues, ExerciseLookupError | BuiltInReadOnlyError>>;
type PrepareDuplicate = (id: ExerciseId) => Promise<Result<ExerciseFormValues, ExerciseLookupError>>;
type ImportPhoto = (source: PhotoSource) => Promise<Result<PhotoView | null, PhotoPickerError | PhotoStoreError>>;
type DiscardPhotos = (fileNames: readonly PhotoFileName[]) => Promise<void>;
type CleanUpOrphanPhotos = () => Promise<Result<number, ExerciseStorageError | PhotoStoreError>>;
type GetExerciseImage = (image: ExerciseImageRef) => Promise<ImageSource>;
interface OfflineImages {
  estimate(): Promise<Result<OfflineImagesEstimate, ExerciseLibraryError>>;   // { missingCount, missingBytes, totalCount }
  start(): void; cancel(): void;
  getState(): OfflineImagesState;    // idle | preparing | running{completed,failed,total} | finished{succeeded,failed,stoppedEarly} | cancelled{succeeded,remaining}
  subscribe(listener: (state: OfflineImagesState) => void): () => void;
}
interface ExerciseDataCredits { datasetName; repositoryUrl; licenceName; licenceUrl }

// ---- DTOs (presentation) ----
interface VocabularyOption { key: VocabularyKey; label: string; isCustom: boolean }
type VocabularyOptions = Readonly<Record<VocabularyKind, readonly VocabularyOption[]>>;
type ExerciseImageRef = ExerciseImage;           // opaque to presentation
type ExerciseSearchQuery = ExerciseQuery;
interface ExerciseListItem { id; name; isCustom; categoryLabel: string; primaryMuscleLabels: string[]; equipmentLabel: string | null; coverImage: ExerciseImageRef | null }
interface ExerciseDetails { id; name; isCustom; category: VocabularyOption; primaryMuscles: VocabularyOption[]; secondaryMuscles: VocabularyOption[];
  equipment: VocabularyOption | null; instructions: string[]; images: ExerciseImageRef[]; trackedMetrics: TrackedMetric[];
  builtIn: { level; force | null; mechanic | null } | null }
interface PhotoView { fileName: PhotoFileName; uri: string }
interface ExerciseFormValues { name; category: VocabularyOption | null; primaryMuscles: VocabularyOption[]; secondaryMuscles: VocabularyOption[];
  equipment: VocabularyOption | null; instructionsText: string; photos: PhotoView[]; trackedMetrics: TrackedMetric[] }
type ExerciseInput = ExerciseDraft;
interface ResolvedVocabularyOption { option: VocabularyOption; selection: VocabularySelection }
type ImageSource = { status: 'available'; uri: string } | { status: 'unavailable' };

// ---- core ----
interface StartupTask { readonly name: string; run(): Promise<unknown> }   // src/core/bootstrap/startup-task.ts
```

**DI tokens** (`exercises.<Name>`): ports `ExerciseReader`, `ExerciseWriter`, `VocabularyReader`, `BuiltInImageCatalog`, `ExerciseSeedSource`, `BuiltInLibraryStore`, `BuiltInImageCache`, `PhotoPicker`, `PhotoStore`; use cases/services/values `EnsureLibrarySeeded`, `FindExercises`, `GetExerciseDetails`, `ListVocabularyOptions`, `ResolveVocabularyValue`, `CreateCustomExercise`, `UpdateCustomExercise`, `DeleteCustomExercise`, `GetExerciseFormValues`, `PrepareDuplicate`, `ImportPhoto`, `DiscardPhotos`, `CleanUpOrphanPhotos`, `GetExerciseImage`, `OfflineImages`, `ExerciseDataCredits`. All exported from `@modules/exercises`.

### Error codes

| Code | Raised by | What the UI does |
|---|---|---|
| `exercises.invalidExercise` (`issues[]`) | `validateExerciseDraft`; create/update | nothing stored; each issue next to its field |
| issue `exercises.nameRequired` / `nameTooLong` (`maximum`) | domain | name field: "Enter a name" / "Use at most 80 characters" |
| issue `exercises.duplicateName` (`existingName`) | create/update use cases (repository check) | name field: "'Barbell Squat' already exists" |
| issue `exercises.categoryRequired` / `unknownCategory` (`key`) | domain | category field |
| issue `exercises.primaryMuscleRequired` / `unknownMuscle` / `muscleListedTwice` (`key`) | domain | primary or secondary muscles field (`unknown…` in the field where the key was) |
| issue `exercises.unknownEquipment` | domain | equipment field |
| issue / error `exercises.vocabularyValueRequired` / `vocabularyValueTooLong` (`maximum`) | domain; `ResolveVocabularyValue` | in the "Add your own" input |
| issue `exercises.instructionsTooLong` (`maximum`) | domain | instructions field |
| issue `exercises.tooManyPhotos` (`maximum`) | domain | photos field (the form also disables **Add photo** at 6) |
| issue `exercises.noTrackedMetric` | domain | metrics field: "Pick at least one" |
| `exercises.notFound` | get/edit/delete/duplicate | "Exercise not found" with a way back |
| `exercises.builtInReadOnly` | update/delete/form-values on a built-in | not reachable from the UI (never offered); generic error if it happens |
| `exercises.storageFailed` (`cause`) | repository ports | inline `ErrorState` with **Retry** (logged) |
| `exercises.seedAssetInvalid` (`reason`) | seed source | Exercises tab `ErrorState` with **Retry** (logged) |
| `exercises.seedFailed` (`cause`) | `EnsureLibrarySeeded` (store write failed) | Exercises tab `ErrorState` with **Retry** (logged) |
| `exercises.imageDownloadFailed` (`cause`) | image cache | placeholder "Image not available offline"; bulk: counted as failed (logged) |
| `exercises.imageDownloadCancelled` | image cache | nothing (not an error) |
| `exercises.photoPermissionDenied` (`source`) | photo picker | short message how to allow camera/photos in Android settings; the other source still works |
| `exercises.photoPickerFailed` / `photoImportFailed` (`cause`) | picker / photo store | "Couldn't add the photo", form kept (logged) |
| `exercises.photoStorageFailed` (`cause`) | photo store list/delete | logged only |
| `exercises.invalidSeedSourceKey` / `invalidDatasetImagePath` / `invalidPhotoFileName` | parse functions | internal: a seed with them is `seedAssetInvalid`; a stored row with them is `storageFailed` |
| `core.startupTaskFailed` (`task`) | bootstrapper | logged only |

### Behaviour the implementations must honour (beyond the TSDoc in the files)

- **Domain (S1-08 to S1-10, S1-12, S1-23):** pure, immutable (frozen results), `Result`-returning, 100 % coverage, Stryker ≥ 80 %. `comparisonKey` uses the explicit combining-mark class of `tooling/exercise-db/text.js` and the same examples. Property tests: `comparisonKey` idempotent; `findMatchingExercises` (results ⊆ library, empty query = all, monotonic facets, sort idempotent); `defaultTrackedMetrics` never empty and never `rpe`; `suggestDuplicateName` never collides and stays ≤ 80; `planLibrarySeed` never changes an existing id and never drops a stored built-in (archives it).
- **Seeding (`createEnsureLibrarySeeded`, S1-12/13):** read the stored version first (`readSeedVersion`), compare with `seedSource.manifest.seedVersion`; only load the dataset when the stored version is lower or `null`. Map a store `err` to `exercises.seedFailed` with the cause. Log the report at `info` and failures at `error` with the code. Memoize the in-flight/successful promise; a failed run is forgotten so the next call retries.
- **Library use cases:** await `ensureLibrarySeeded()` first and return its `err` unchanged; then read, apply domain functions, map to DTOs (a missing label falls back to the key). Log every `err` at `warn` with its code (except `notFound`, which is `info`).
- **Create/update:** run `validateExerciseDraft` and the name check, merge the `duplicateName` issue into the same `exercises.invalidExercise` (if validation passed but the name is taken, the error has just that issue). Update: removed photos (old `images` minus new) are deleted after a successful save.
- **`SingleFlightImageCache` (Decorator, application):** wraps the real cache; concurrent `download(path)` calls share one task until it settles; `localUri`/`cachedPaths` delegate.
- **`createOfflineImages`:** state transitions `idle → preparing → running → finished | cancelled`, and `finished | cancelled → preparing` on `start()`. `estimate()` and `start()` await `ensureLibrarySeeded`. Missing = `catalog.listActiveBuiltInImages()` minus `imageCache.cachedPaths()`; `missingBytes` = sum of `sizeBytes`. A preparing failure ends in `finished` with `failed = 0, succeeded = 0` and a logged error.
- **SQLite adapters (S1-04, S1-14):** written against `SqliteDatabase` (works with expo-sqlite and better-sqlite3); `name_key` = `comparisonKey(name)` written on every save; JSON columns through validating row mappers; seed inserts in batches of ≤ 100 rows inside the single transaction. `findById` without `includeArchived` returns `null` for archived rows. `applySeed`: insert/update built-ins, `archived = 1` for `archive` ids, upsert built-in vocabulary rows (`origin = 'builtIn'`), upsert the single seed row — in one transaction.
- **Seed source (`AssetExerciseSeedSource`):** constructed with the parsed `manifest.json` (static import in the adapter file) and a loader `() => import('@assets/exercise-db/exercises.json')` (lazy; tests inject fixtures). A manifest of the wrong shape or `formatVersion` ≠ 1 throws at construction (broken build artefact; the composition-root test constructs it, so CI fails). `loadDataset` validates format version, seed version = manifest's, and every record through the domain parse functions, otherwise `exercises.seedAssetInvalid`.
- **Image cache (`ExpoFileSystemImageCache`):** constructor `{ imageBaseUrl }` (from the manifest); folder `Paths.document/exercise-images/`; download to `<path>.part` then move; delete partial files on failure/cancel; `cachedPaths` lists the folder recursively once; an existing file short-circuits `download`.
- **Photo picker (`ExpoPhotoPicker`):** camera → `requestCameraPermissionsAsync` then `launchCameraAsync`; library → `launchImageLibraryAsync` (Android's photo picker needs no permission; if Expo reports a denied permission, map it); options `{ mediaTypes: ['images'], allowsEditing: false, quality: 1 }`; `canceled` → `ok(null)`.
- **Photo store (`ExpoPhotoStore`):** `ImageManipulator.manipulate(uri)`, `resize` only if the longest side > 1 600 (keep aspect ratio), `renderAsync()`, `saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })`, move into `Paths.document/exercise-photos/<idGenerator.next()>.jpg`; delete the intermediate file; on failure remove anything written.
- **Bootstrapper (`StartupTask`):** see `startup-task.ts`. The composition root registers the tasks as `{ name: 'exercises.EnsureLibrarySeeded', run: () => resolver.resolve(EnsureLibrarySeededToken)() }` and the same for `CleanUpOrphanPhotos`.
- **Composition root:** registers every port and use case above (lazy singletons; `EnsureLibrarySeeded`, `OfflineImages` and the single-flight cache **must** be singletons), `ExerciseDataCreditsToken` from `seedSource.manifest.source`, and the image cache adapter wrapped in `SingleFlightImageCache`. Its test resolves every new token with the native modules (`expo-file-system`, `expo-image-picker`, `expo-image-manipulator`) mocked at the boundary and constructs the real migrator with the generated drizzle bundle (S1-04).
- **Presentation (ui-dev):**
  - Routes: root `app/_layout.tsx` passes `<Stack />` (expo-router) as `AppShell` children instead of `<Slot />` (tabs group as the first screen, header hidden); new thin routes `app/exercises/[id]/index.tsx` (detail), `app/exercises/[id]/edit.tsx`, `app/exercises/new.tsx` (`?duplicateOf=<id>` for S1-23). Route params become `ExerciseId` with `parseExerciseId` (an invalid id shows "Exercise not found").
  - Library: view model holds text + filters, debounces the text (≤ 250 ms), calls `FindExercises`; filters from `ListVocabularyOptions`; refreshes on focus (`useFocusEffect`) so created/edited/deleted exercises show; virtualised `FlatList` with a named `MAX_MOUNTED_ROWS` asserted in a test. The tab stays mounted under the stack, so search, filters and scroll survive the detail and the form.
  - Images: one `ExerciseImage` component + hook calling `GetExerciseImage`; placeholder with the label "Image not available offline"; `expo-image` with `cachePolicy="memory"` on the returned `file://` URI only.
  - Form: shows issues by `field` with texts from an exhaustive `Record<ExerciseFieldErrorCode, …>` presenter; pickers from `ListVocabularyOptions` + **Add your own** via `ResolveVocabularyValue`; photos via `ImportPhoto`, removed/discarded ones via the save use cases / `DiscardPhotos`; "Discard changes?" on back/cancel when dirty; **Add photo** disabled at `EXERCISE_LIMITS.photosMax` with "Up to 6 photos".
  - Offline images: `OfflineImagesSection` (exported by `exercises`, rendered in Settings) uses `useSyncExternalStore(offlineImages.subscribe, offlineImages.getState)`, `estimate()` for the confirmation ("1 746 images, about 99 MB. Use Wi-Fi if you can."; decimal MB), progress "n of total" with the accessibility label "Image download progress, n of total", Cancel, summary with Retry failed, and the text "Keep the app open until the download finishes. Images downloaded so far are kept."
  - Credits: Settings resolves `ExerciseDataCreditsToken`; labels for metrics, level, force and mechanic are exhaustive `Record`s in presentation.

### Contract suites (Liskov; fake and real adapter run the same suite)

`test/contracts/exercise-reader.contract.ts`, `exercise-writer.contract.ts` (incl. "name taken" cases and new vocabulary values in the same transaction), `vocabulary-reader.contract.ts` (create, reuse built-in, reuse existing, list, survives re-seed), `built-in-image-catalog.contract.ts`, `built-in-library-store.contract.ts` (incl. interrupted/failed apply leaves no change, custom rows untouched), `exercise-seed-source.contract.ts`, `built-in-image-cache.contract.ts` (incl. network stubbed as unavailable, no partial file visible), `photo-picker.contract.ts`, `photo-store.contract.ts` (incl. source deleted after import, failed import leaves nothing), `offline-images.contract.ts` (fake service vs real service on fakes). Already done in Phase 1: `logger.contract.ts` (S1-02).

### Phase 2 ownership (non-overlapping)

| Owner | Files (create or change) |
|---|---|
| **core-dev** | `src/shared/domain/{numbers,weight,duration,distance}.ts` (+ tests, S1-01); `src/modules/exercises/domain/**`; `src/modules/exercises/application/**` (implementations next to the contract types, new files); `src/modules/exercises/infrastructure/**`; `src/shared/infrastructure/db/app-migrations.ts`, `src/shared/infrastructure/db/migrations/**` (generated, S1-04); `src/core/bootstrap/bootstrapper.ts` (+ test); `src/core/di/composition-root.ts` (+ test); `src/modules/exercises/index.ts` **domain/application sections only** (new domain-function exports such as `EXERCISE_LIMITS`, `TRACKED_METRICS`); new files in `test/fakes/`, `test/builders/`, `test/contracts/`, and `test/support/` (native-module stand-ins for the adapters) |
| **ui-dev** | `src/shared/ui/**` (S1-06, S1-07, new shared components); `src/modules/updates/presentation/**` (move to the shared `Button`); `src/core/presentation/app-tabs.tsx` (+ test, S1-05); `src/modules/exercises/presentation/**`; `src/modules/exercises/index.ts` **presentation section only**; `src/modules/settings/presentation/**`, `src/modules/settings/index.ts`; `app/**`; new presentation harnesses in `test/support/` named `exercise-*-harness.tsx`; `testID`s requested by QA (S1-25) in the files above |
| **qa-engineer** (Phase 3) | `e2e/**`, the S1-26 checklist, QA report in this file |
| **architect** | the Phase 1 contract files (signature changes on request), `tooling/**`, `assets/exercise-db/**`, `package.json` / `package-lock.json`, `app.json`, `eslint.config.js`, `jest.config.js`, `.prettierignore`, ADR-004 |

New dependencies are architect-owned: if Phase 2 needs one, ask first (`package.json` has one owner).

**Order inside Phase 2.** core-dev's **first** deliverable unblocks ui-dev and should be small (one commit-sized step): `normaliseDisplayText` / `comparisonKey`, `TRACKED_METRICS`, the three `parse…` functions, and the builders `aBuiltInExercise()`, `aCustomExercise()`, `anExerciseSummary()`, `aVocabularyValue()`, `vocabularyKeyOf(label)` (through `comparisonKey`, no casts) **plus DTO builders** `anExerciseListItem()`, `anExerciseDetails()`, `aVocabularyOption()`, `anExerciseFormValues()`, `aPhotoView()` in `test/builders/exercise*.builder.ts`, and `FakeOfflineImages` in `test/fakes/` (a controllable service ui-dev needs for the Settings section; it passes `offline-images.contract.ts` once the real service exists). Then core-dev continues with the port fakes (`InMemoryExerciseStore` implementing the repository ports, `FakeExerciseSeedSource`, `FakeBuiltInImageCache`, `FakePhotoPicker`, `FakePhotoStore`) for its own use-case tests, and the adapters. Until the first deliverable lands, ui-dev does S1-05, S1-06, S1-07, the root `Stack`, and presentational list/detail/form components with plain view props (strings, booleans, callbacks). View-model tests stub the use cases with plain functions typed as `FindExercises`, `GetExerciseDetails`, … (they are functions; no fakes needed) and use the shared builders for values.

---

## Out of scope for Sprint 1

- Using exercises in routines, logging sets, history and stats (Sprints 2–5). Sprint 1 only keeps ids stable and deletion forward-compatible.
- Restoring deleted exercises, undo, or a "deleted exercises" screen.
- Editing built-in exercises in place (decision Q2), multiple equipment per exercise.
- Managing user-defined vocabulary values: renaming, merging or deleting your own categories/muscles/equipment (decision Q5; Deferred). Unused own values simply stay.
- Filters other than muscle, equipment and category (e.g. level, force, "custom only"), favourites, recently used, sorting options.
- Reordering photos (the first photo is the cover), zoom / full-screen image viewer, video.
- Automatic or scheduled bulk image downloads, Wi-Fi-only settings, deleting the image cache from the app (the bulk download in S1-28 is user-triggered only); translations of the dataset (English only).
- Backup/export of custom exercises and photos (Sprint 6).
- Offering an app update on the startup failure screen (Sprint 0.5 Q6 stays "no"; revisit if the first real migration causes trouble).

---

## Definition of Done (every story, from `docs/ENGINEERING_STANDARDS.md` §6)

1. Meets all acceptance criteria in this file.
2. Respects the layer and module boundaries; `npm run lint` (including boundary rules) passes.
3. Developed with TDD (§4.1); `npx tsc --noEmit` and `npm test -- --coverage` pass with all per-layer coverage thresholds met.
4. No duplicated business logic; new extension points documented.
5. Architect design review done; significant decisions recorded as ADRs in `docs/adr/`.
6. Runs in Expo Go on Android.

For this sprint, item 6 means: the feature works in Expo Go **and** in the release APK built by the Sprint 0.5 pipeline, including an update from the Sprint 0.5 build that keeps data.

In addition, each agent report includes TDD evidence: the tests written first, confirmed to have been seen failing before the implementation (§4.1).

---

## Decisions

Answered by the user on 2026-11-16:

1. **Q1 — Deleting a custom exercise: archive.** A deleted custom exercise is hidden everywhere in the library and pickers but kept in the database (so later routines and history still show its name); its photos are deleted right away; no restore screen in Sprint 1. → S1-14, S1-21.
2. **Q2 — Duplicate as custom: yes.** Built-ins stay fully read-only; "Duplicate as custom" opens a prefilled create form. → S1-17, S1-23.
3. **Q3 — Default tracked metrics for built-ins: accepted as proposed.** Cardio → time + distance; stretching → time; plyometrics → reps; strength-type with "body only" → reps; other strength-type → weight + reps; RPE never preselected. → S1-10.
4. **Q4 — Built-in images:** downloaded **on demand** (on any connection) with **thumbnails** in the list, cached for offline use, **plus** a user-triggered **"Download all images for offline use"** action in Sprint 1 (confirmation with estimated size/count, progress, cancel, resumable, failures with retry, non-blocking). → S1-18, new S1-28.
5. **Q5 — Values for custom exercises:** pick from the dataset's fixed lists **and** add your own categories, muscles and equipment from the form. Own values are validated, persisted, shown in pickers and filters, and survive re-seeding; unused own values stay; managing them is deferred. → S1-08, S1-09, S1-12, S1-15, S1-19, new S1-29.
6. **Q6 — Names: unique across all.** A custom exercise name may not equal any built-in exercise name or any active custom exercise name (case- and accent-insensitive, after trimming); archived exercises don't block a name. Duplicating prefills a non-colliding name ("<name> (custom)", then "(custom 2)", …). A later re-seed that adds a built-in with the same name as an existing custom exercise neither fails nor renames it; both are kept (the rule applies only when the user creates or renames). → S1-08, S1-12, S1-19, S1-20, S1-21, S1-23.

Sprint 0.5 status (user, 2026-11-16): the first real CI release run succeeded and a release APK was published; S05-14 (on-device update verification) is still pending and is folded into S1-26.

The PO assumptions below apply unless the user overrides them.

### PO assumptions (change on request; not changes to `PLAN.md`)

- **A1** — English UI; dataset text is shown as provided (vocabulary values capitalised for display, e.g. "Body only").
- **A2** — Equipment is a single value per exercise, as in `PLAN.md` §3 and the dataset; "Body only" / "None" count as equipment values.
- **A3** — A custom exercise needs at least one primary muscle (so muscle filters can find it); secondary muscles are optional.
- **A4** — The muscle filter matches primary muscles only.
- **A5** — Up to **6** photos per custom exercise.
- **A6** — Instructions are stored as an ordered list of steps; the form edits them as multi-line text, one step per line; empty lines are dropped. Instructions are optional (proposed maximum 5 000 characters in total).
- **A7** — No metric is preselected in the create form; the user must pick at least one.
- **A8** — Custom photos are stored as JPEG, downscaled so the longest side is at most about 1 600 px (architect fixes exact values).
- **A9** — If seeding fails, the Exercises tab shows an error with Retry rather than a partial library.
- **A10** — "Duplicate as custom" does not copy built-in images.

## User actions needed

- At the end of the sprint: run the S1-26 checklist on the phone (QA writes it; it includes the still-pending Sprint 0.5 S05-14 update steps), and allow camera and photo access when the app asks.
- For the S1-28 check: be on Wi-Fi for the full image download (estimated tens of MB).
- Optional: install Maestro and `adb` if you want to run the e2e flows yourself (`e2e/README.md`).

## Open questions

No open product questions: Q1–Q6 were answered on 2026-11-16 (see "Decisions").

For the architect (Phase 1, technical; not for the user):

- **T1 —** Where search/filter lives (domain predicates vs application query), and whether filtering runs in SQL or in memory over ~900 summaries (S1-09, S1-14, S1-16 timing).
- **T2 —** Seed inside the bootstrap sequence (if within 500 ms on the phone) or after the tabs appear (S1-13); how the Exercises tab learns that seeding is in progress or failed.
- **T3 —** Image caching mechanism for built-ins (image library disk cache vs explicit download into a persistent app folder; S1-18 requires survival across restarts offline), and how the pinned dataset image location is configured.
- **T4 —** Table layout for list fields (muscles, instructions, images, tracked metrics: join tables vs JSON columns) and how the archived flag and seed version are stored (S1-04, S1-12, S1-14).
- **T5 —** Licence confirmation for the dataset's data and images (S1-11) and the exact vocabularies of the pinned version.
- **T6 —** Port split for photos (picker vs photo store) and the image-manipulation dependency for A8, all usable in Expo Go.
- **T7 —** How user-defined vocabulary values are modelled (S1-29): value objects stored on the exercise vs a vocabulary entity table with ids per kind; how built-in and own values are told apart; whether a new value is persisted with the exercise save (the AC assumes yes) or on its own; how S1-08 validation learns the set of known values.
- **T8 —** Bulk image download (S1-28): placement (proposed Settings → "Offline images" plus a link from the Exercises tab), concurrency, size estimate source (seed metadata vs a named average), behaviour when the app goes to the background or is closed (continue vs stop and resume on request; Expo Go has no background task for this), and T3's cache choice, which must be persistent enough that a completed bulk download stays useful (an OS-cleared cache would undo it).
- **T9 —** Collisions caused by a re-seed: a new built-in exercise name equal to an existing custom exercise name (decision: both kept; confirm the uniqueness check is enforced in the create/edit use cases only, not as a database unique constraint across both kinds), and a new built-in vocabulary value equal to a user-defined value (merge or keep both while showing one entry; no exercise may change meaning).

### Architect rulings on T1–T9 (Phase 1, 2026-11-16; rationale in ADR-004)

- **T1 — Search/filter/sort:** pure **domain** functions (`exercises/domain/exercise-query.ts`: one Specification per facet, `findMatchingExercises`), applied **in memory** by the application use case over the active summaries read per query (~880 rows). No SQL filtering, no FTS. Fallback if the device misses 300 ms: a caching Decorator around `ExerciseReader`, not a change to the rules.
- **T2 — Seeding runs after the tabs appear,** as a background startup task started by the bootstrapper after the migrations (`StartupTask`). The Exercises tab learns about it through the use cases: every library use case awaits the memoized `EnsureLibrarySeeded` (loading state while it runs, `err` → error state; **Retry** = call again, which starts a new run after a failure). Seeding inside the bootstrap sequence was rejected (unmeasured 500 ms budget; a failure would block every tab).
- **T3 — Explicit download into app document storage** (`Paths.document/exercise-images/<dataset path>`, expo-file-system, temp file + move), not expo-image's disk cache (cache directory, size-capped eviction, no progress/cancel/listing). The pinned image location is `imageBaseUrl` in the generated `assets/exercise-db/manifest.json`, injected into the adapter by the composition root.
- **T4 — One `exercises` table with JSON text columns** for muscles, instructions, images and tracked metrics (filtering is in memory, writes are one row); `archived` integer boolean; `source_key` unique (null for custom); indexed `name_key`. Seed version in a single-row `exercise_library_seed` table. Vocabulary values in `exercise_vocabulary_values` (PK kind + key + origin).
- **T5 — Licence confirmed for data and images:** The Unlicense (public domain) covers the whole repository including `exercises/**/*.jpg`; copy in `assets/exercise-db/LICENSE.md`. Pinned commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`. Exact vocabularies in ADR-004 §1 and `tooling/exercise-db/pin.js`.
- **T6 — Two ports:** `PhotoPicker` (expo-image-picker) and `PhotoStore` (expo-image-manipulator + expo-file-system). A8 fixed: longest side ≤ **1 600 px** (never upscaled), JPEG quality **0.8**. All in Expo Go.
- **T7 — Vocabulary values are value objects identified by `(kind, comparisonKey(label))`;** exercises store keys; built-in and own values share one table and are told apart by `origin`. A new value is persisted **with the exercise save** (same transaction), as the AC assumes; the picker previews it with `ResolveVocabularyValue` (no write). Validation receives the merged `Vocabulary` loaded by the use case.
- **T8 — Bulk download:** placement confirmed (Settings → "Offline images", component exported by `exercises`; the detail placeholder links to it). Concurrency **4**; estimate = **exact** sum of per-image sizes in the seed (labelled "about"); ends early after **5 consecutive failures**; one run per process (singleton service); **no background continuation** (Expo Go): if Android suspends or kills the app, finished images are kept and the user starts again (only missing ones are fetched); the UI says so. The cache is document storage, so an OS cache clear does not undo it.
- **T9 — Confirmed:** name uniqueness is enforced **only** in the create/update use cases (repository lookup by comparison key, active exercises only), **no** database unique constraint across built-in and custom names. A re-seeded built-in value equal to a user-defined value: **keep both rows, show one** (built-in label and origin win); exercises store the key, so none changes meaning.

### Architect review of the PO assumptions and numbers (Phase 1)

- **A2 refined:** equipment is a single value but **optional** (`null` = not specified): 77 built-ins have no equipment, and the same rule applies to custom exercises. An equipment filter never matches `null`. "None" is not a dataset value (the dataset has "body only" and "other").
- **Category is required** for custom exercises (new code `exercises.categoryRequired`; the form can't save without one). All other assumptions (A1, A3–A10) stand as written; A5 = 6 photos, A6 = 5 000 characters, name 80, own value 40.
- **Numbers corrected:** the pinned dataset has **876** exercises (not ~800) and **1 746** images totalling **98 671 281 bytes ≈ 98.7 MB** (not "1 512 images, about 90 MB"); the S1-28 example is updated. 9 upstream records listed a muscle as both primary and secondary; the converter drops it from the secondary list (S1-08's `muscleListedTwice` rule then holds for built-ins too).
- **S1-15 "plus the total count":** the result count is the length of the returned list (no separate field that could disagree).
- **S1-09 placement:** domain (T1).
- **S1-13:** "tabs first, loading state on the Exercises tab" is the chosen option (T2).

### Dataset facts (S1-11, architect, done in Phase 1)

| Item | Value |
|---|---|
| Upstream | `yuhonas/free-exercise-db`, commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (2026-09-27) |
| Licence | The Unlicense (public domain), data **and** images; copy in `assets/exercise-db/LICENSE.md` |
| Exercises | 876 (seed version 1, content hash in `manifest.json`) |
| Categories (7) | cardio, olympic weightlifting, plyometrics, powerlifting, stretching, strength, strongman |
| Muscles (17) | abdominals, abductors, adductors, biceps, calves, chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck, quadriceps, shoulders, traps, triceps |
| Equipment (12 + none) | bands, barbell, body only, cable, dumbbell, e-z curl bar, exercise ball, foam roll, kettlebells, machine, medicine ball, other; 77 exercises without |
| Level / force / mechanic | beginner, intermediate, expert / pull, push, static (30 none) / compound, isolation (87 none) |
| Images | 1 746 JPEGs (873 exercises × 2, 3 without), 98 671 281 bytes, average 56.5 KB, largest 919 KB; not bundled |
| Seed asset | `assets/exercise-db/exercises.json` 919 031 bytes (174 KB gzipped) + `manifest.json` 642 bytes |
| Converter | `tooling/exercise-db/` (`npm run exercise-db:convert`, 100 % coverage; how to regenerate: `assets/exercise-db/README.md`) |

### Phase 1 record (architect, 2026-11-16)

- **Done:** S1-11 (converter test-first, seed asset generated), S1-02 (Logger contract suite, run against `RecordingLogger` and `ConsoleLogger`; README and ADR-001 updated), S1-03 (`boundaries.test.ts` 358 lines → `boundaries-{layers,external-packages,modules,test-files}.test.ts`, 124/98/128/63 lines; the same 97 case names before and after, compared by QA-style diff), ADR-004 drafted (Proposed), ADR-003 status updated (first real release run succeeded), contract files and public API above.
- **Boundary policy changes (test-first):** `expo-image-manipulator` forbidden in presentation; `expo-image-picker` / `expo-image-manipulator` / `expo-image` forbidden in domain and application (cases added); `expo-image` and `@expo/vector-icons` allowed in presentation (cases added); `@assets/exercise-db/*` forbidden in domain, application, presentation and `app/`. Coverage: `tooling/exercise-db/**/*.js` at 100 % (entry point excluded like the release CLI).
- **Dependencies:** `expo-image`, `expo-image-picker` (+ config plugin), `expo-image-manipulator`, `@expo/vector-icons`, `expo-font`, `expo-asset` (ADR-004 §8). Jest renders `expo-image` and `@expo/vector-icons` without extra mocks (`test/toolchain/native-ui-modules.test.tsx`).
- **Gates (real output, after Phase 1):** `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm test -- --coverage` 110 suites / 1 139 tests passed, coverage 100 % statements, branches, functions and lines (all thresholds met), ~27 s; `npx expo-doctor` 20/20; `npm run format:check` clean; `npx expo install --check` up to date.

### Phase 2 record (ui-dev — Settings)

- **Done (S1-28 UI, S1-24):** `OfflineImagesSection` (exported from `@modules/exercises`, presentation section) = `offline-images-section.tsx` (renders) + `use-offline-images.ts` (view model: `useSyncExternalStore` over the `OfflineImages` singleton, estimate through `useResultLoader`, reloaded when a run ends; confirmation state; only `confirmDownload` / `retryFailed` call `start()`) + `offline-images-views.tsx` (estimate loading / error with Retry / "n of total missing" + **Download all images** / "All images are available offline"; preparing; progress bar "Image download progress, n of total" (finished = succeeded + failed) with "Cancel download"; summary with **Retry failed** when `failed > 0`; cancelled summary + resume through **Download all images**) + `offline-images-texts.ts` (presenter: "1 746 images, about 99 MB. Use Wi-Fi if you can.", decimal MB, thousands grouped with a space). T8 text "Keep the app open until the download finishes. Images downloaded so far are kept." shown while preparing/running. Settings (`settings-screen.tsx`, now in a `ScrollView`) renders the existing "coming soon" text, `OfflineImagesSection`, `DataCreditsSection` ("Credits", label "Exercise data credits": "Exercise data and images: <datasetName>", repository URL, "Licence: <licenceName>", licence URL, all from `ExerciseDataCreditsToken` via `use-data-credits.ts`) and the unchanged app version. Settings imports only `@modules/exercises`.
- **TDD (seen red first):** `offline-images-texts.test.ts` (module missing), `use-offline-images.test.tsx` (module missing; the estimate-refresh test also seen failing with the reload removed), `offline-images-section.test.tsx` (module missing), `settings-screen.test.tsx` new cases (failed on missing "Offline images" / "Credits" headers and "Exercise data credits" label). Tests use `FakeOfflineImages`; the estimate-failure/pending cases wrap it in a test-local `OfflineImages` (the fake cannot clear an estimate failure).
- **Open:** the credits URLs are shown as text, not tappable: opening a URL is a device service (`Linking`), which presentation may not call; a tappable link needs a `UrlOpener` port + adapter (architect/core-dev decision, not done). The composition root must register `OfflineImagesToken` (singleton) and `ExerciseDataCreditsToken` (from the manifest) before Settings renders in the app (already in core-dev's scope, not yet present at the time of writing).

### Phase 2 record (core-dev — device adapters)

- **Done (S1-18, S1-22, S1-28 adapter side):** in `src/modules/exercises/infrastructure/`: `exercise-image-config.ts` (folders `exercise-images` / `exercise-photos` under `Paths.document`, `.part` suffix, JPEG `.jpg` at 0.8, longest side 1 600 px; `parseImageBaseUrl` (https, trailing `/`; throws on a broken manifest, a programmer/build error) and `builtInImageUrl(base, path)`); `ExpoFileSystemImageCache` (`BuiltInImageCache`): `download` streams `imageBaseUrl + path` into `<path>.part` (`idempotent`, `AbortSignal`), then checks for a cancel and calls `moveSync` with no `await` in between, so a cancel before settling always gives `imageDownloadCancelled`; the partial file is removed on failure/cancel (a cleanup failure is added as `details.cleanupFailure`); an existing file short-circuits without a request; `cachedPaths` lists the folder recursively once, skips `.part` and names that are not valid `DatasetImagePath`s, and returns an empty set when listing fails; `ExpoPhotoPicker` (`PhotoPicker`): a per-source launch table (Strategy): the camera asks `requestCameraPermissionsAsync` first and the library asks for nothing; options `{ mediaTypes: ['images'], allowsEditing: false, quality: 1 }`; a cancel gives `ok(null)`; a denied camera permission, or Android's `ERR_USER_REJECTED_PERMISSIONS` while launching, gives `photoPermissionDenied { source }`; anything else (including "success" with no asset) gives `photoPickerFailed`; `ExpoPhotoStore` (`PhotoStore`): `ImageManipulator.manipulate(uri)`, resizes only the longest side when it is over 1 600 px (never upscales), `renderAsync`, `saveAsync({ format: JPEG, compress: 0.8 })`, then `moveSync` into `exercise-photos/<idGenerator.next()>.jpg`; the name is checked with `parsePhotoFileName` before touching the image, and an import whose name already exists is refused, so the cleanup never deletes a kept photo; on failure the encoded intermediate and the target are removed; listing ignores folders and foreign files; `file-cleanup.ts` (`removeFileQuietly`, shared by both file adapters).
- **Native stand-ins (`test/support/`):** `in-memory-expo-file-system.ts` extended **additively** (`Paths.document`, `File.move` / `moveSync` with overwrite rules and URI update, `File.parentDirectory`, `Directory.create({ intermediates })`, `Directory.list`, `failingMoves` / `failingLists`); all of its old tests and the `updates` adapter tests are unchanged and green. New: `in-memory-image-picker.ts` and `in-memory-image-manipulator.ts` (with tests; the manipulator tracks pixel sizes, keeps the aspect ratio when only one side is given, and writes its output into the in-memory file system).
- **Contract suites:** `built-in-image-cache`, `photo-picker` and `photo-store` contract suites run against the real adapters (native boundary mocked), next to the fakes' runs.
- **TDD (seen red first):** stand-in tests (7 failing, then `moveSync` 1 failing, then `parentDirectory` 1 failing), `exercise-image-config.test.ts`, `expo-file-system-image-cache.test.ts`, `in-memory-image-picker.test.ts`, `expo-photo-picker.test.ts`, `in-memory-image-manipulator.test.ts` and `expo-photo-store.test.ts` (each "module missing" before the implementation). One test came after the code: "ignores folders" in the photo store (it covers a guard that was already written). One test was itself wrong at first (the cancel was set up too late) and was fixed in the test, not in the code.
- **For the composition root:** `new ExpoFileSystemImageCache({ imageBaseUrl: seedSource.manifest.imageBaseUrl })` wrapped in `SingleFlightImageCache` (singleton); `new ExpoPhotoPicker()`; `new ExpoPhotoStore({ idGenerator })` (`IdGeneratorToken`, `CryptoIdGenerator` UUIDs fit `[A-Za-z0-9_-]+\.jpg`). Its test must also mock `expo-image-picker` and `expo-image-manipulator` with the new stand-ins.
- **Notes:** `removeFileQuietly` repeats the private `removeFile` helper in `updates/infrastructure/expo-apk-downloader.ts` (a second copy across modules). If a third module needs it, move it to `src/shared/infrastructure/` (not done: it would change the `updates` module). The resize uses the size the picker reports, as specified. If a device photo turns out to be rotated by EXIF with its width and height swapped, the stored longest side could go over 1 600 px; check this at S1-26.

### Phase 2 record (core-dev: domain, application, bootstrap; 2026-11-16)

Scope after the coordinator's split: this agent owns the exercises domain and application layers, the bootstrapper's startup tasks and the domain/application part of `exercises/index.ts`. Infrastructure (S1-04 schema/migrations, SQLite adapters, asset seed source, expo file-system image cache, photo picker, photo store, image config), `test/support/**` and the composition root belong to the other core-dev agents and to the integration step. This agent created nothing in those paths.

- **Done earlier in Phase 2:** S1-01; every exercises domain function with tests (S1-08, S1-09, S1-10, S1-12 plan, S1-23 name, S1-29 values); builders, fakes and contract suites; DTO mappers; `exerciseStorageFailed`; `createEnsureLibrarySeeded` (S1-12/S1-13 memoizing proxy with retry).
- **Done in this session (test-first; each test file was run and seen failing with "create… is not a function" or "Cannot find module" before the code existed):**
  - Use-case factories, each in the file holding its type and token: `createFindExercises`, `createGetExerciseDetails`, `createGetExerciseFormValues`, `createGetExerciseImage`, `createListVocabularyOptions`, `createResolveVocabularyValue`, `createCreateCustomExercise`, `createUpdateCustomExercise`, `createDeleteCustomExercise`, `createPrepareDuplicate`, `createImportPhoto`, `createDiscardPhotos`, `createCleanUpOrphanPhotos` (S1-13, S1-15, S1-18 to S1-23, S1-29).
  - `createOfflineImages` with `OFFLINE_IMAGES_CONCURRENCY = 4` and `CONSECUTIVE_FAILURES_TO_STOP = 5` (S1-28). It passes `offline-images.contract.ts` on fakes, next to `FakeOfflineImages`. The run is one `OfflineImagesRun` object (state machine, worker pool over one shared iterator); the service is the Observer.
  - `SingleFlightImageCache` Decorator (S1-18/S1-28).
  - `createBootstrapper({ …, startupTasks })` (S1-13): resolves `ok` first, then runs the tasks one after another in the background. A rejecting or throwing task is logged as `core.startupTaskFailed` (`details.task`, `details.cause`) and the next task still runs. Nothing runs after a failed startup.
- **New application helpers (DRY, application layer):** `library-use-case-support.ts` (`logged`: `warn` with code, `info` for `exercises.notFound`, not logged for `exercises.invalidExercise` / `exercises.photoPermissionDenied`, which are user input or choices; `loadVocabulary`; `findActiveExercise`; `exerciseNotFound`; `nextExerciseId`, now also used by seeding). Also `validate-exercise-input.ts` (field rules plus name uniqueness, shared by create and update), `photo-cleanup.ts` (best-effort deletion after a saved change), `missing-images.ts` (active built-in images minus cached ones; used by both the estimate and the run) and `offline-images-run.ts`.
- **Domain additions (my ownership, no Phase 1 signature changed):** `requireCustomExercise` (the shared built-in read-only guard; `updateCustomExercise` and `archiveExercise` now use it), `reviseCustomExercise` (the update when the exercise is already known to be custom) and `resolveNewVocabularyValue` (the existing private `resolveNew`, exported so `ResolveVocabularyValue` gets the narrow `VocabularyValueError` type). `exercise-dto-mappers.ts` exports `toVocabularyOption`.
- **Behaviour choices worth reviewing:**
  - Update refuses a built-in id (`builtInReadOnly`) **before** validating, so nothing is checked or written.
  - The edit prefill leaves out a photo whose file is missing, because it cannot be shown.
  - `ImportPhoto` returns `photoImportFailed` if the stored copy cannot be found right after the import.
  - `DiscardPhotos` deletes nothing when the referenced names cannot be read, because nothing is then provably safe to delete.
  - A cancel during `preparing` ends in `cancelled { succeeded: 0, remaining: <missing> }` once the listing completes, and nothing is downloaded.
  - When a run stops early, images that were never attempted count as failed, and a download that succeeds while the run is stopping still counts as succeeded.
  - `OfflineImages` emits each state once without a dedupe check. Every state a run reports differs from the previous one, and the contract case "never notifies the same state twice" proves it.
- **Tests that passed on first run (they cover existing behaviour and close coverage gaps; not red-first):** "returns a failed save and deletes no photo" (delete, writer-only failure) and "ignores cancel after the run finished" (offline images).
- **`index.ts`:** unchanged. The architect already exported every type, port, token and the needed domain constants. Presentation imports its own module's files, and the composition root imports application files directly (the existing `updates` pattern), so no consumer needs the factories or the new helpers. Adding them would widen the API without a user (YAGNI).
- **Open for the integration step (composition root, not done here):**
  - Register the 13 factories, `createOfflineImages` (singleton) and `new SingleFlightImageCache(adapter)` (singleton) around the image-cache adapter.
  - Pass `startupTasks: [{ name: 'exercises.EnsureLibrarySeeded', run: () => resolver.resolve(EnsureLibrarySeededToken)() }, { name: 'exercises.CleanUpOrphanPhotos', … }]` to `createBootstrapper`.
  - Register `ExerciseDataCreditsToken` from `seedSource.manifest.source`.
- **Gates (real output, 2026-11-16, at the end of this session, with the other agents' work in progress in the tree):**
  - `npx tsc --noEmit`: exit 2. 8 errors, all in `src/modules/exercises/infrastructure/asset-exercise-seed-source.test.ts` (infrastructure agent, in progress); none in domain, application or bootstrap.
  - `npm run lint`: exit 0.
  - `npm test -- --coverage`: 194 suites / 2 121 tests passed. Exit 1 only because `src/modules/exercises/infrastructure/exercises.schema.ts` (infrastructure agent, in progress) is below its 90 % threshold (60 % statements/lines, 0 % functions). Global 99.88 % statements, 99.44 % branches, 99.69 % functions, 99.91 % lines. Every file in `exercises/domain`, `exercises/application` and `core/bootstrap` is at 100 %.
  - `prettier --check` on the owned folders: clean.

### Phase 2 record (ui-dev — library, detail, form)

Scope after the coordinator's split: S1-24, the S1-28 Settings section and the `offline-images*` component belong to the second ui-dev agent (record above); this record covers the rest of ui-dev's stories.

- **Done:** S1-05 (tab icons, label-only announcement, active/inactive tokens), S1-06 (shared `Button` with primary / secondary / destructive variants, touch-target and pressed-opacity tokens, updates prompt moved over), S1-07 (`ErrorState` is a **polite** live region: it replaces content the user asked for, so it should not interrupt; Retry is a shared `Button`), S1-13 UI (loading state while seeding, `ErrorState` + Retry for `seedAssetInvalid` / `seedFailed` / `storageFailed`), S1-16, S1-17 (root `AppStack`, detail + gallery, "Exercise not found"), S1-18 UI (one `ExerciseImage` + `useExerciseImage`, thumbnails, placeholder "Image not available offline"), S1-19 / S1-20 (form, edit mode, "Discard changes?"), S1-21 (confirmation "Delete '<name>'?", Cancel / Android back delete nothing, back to the list after delete), S1-22 UI (Camera / Gallery chooser, per-source permission messages, "Couldn't add the photo", Add photo disabled at 6 with "Up to 6 photos", discarded copies deleted), S1-23 (Duplicate as custom → `/exercises/new?duplicateOf=<id>` prefilled by `PrepareDuplicate`), S1-28 links (see below), S1-29 UI ("Add your own" in every form picker through `ResolveVocabularyValue`, own values marked "Custom" in pickers and filters, the same value added twice is offered and chosen once).
- **This session:** fixed the two `tsc` errors without casts. `exercise-image.tsx` now types the frame as `ImageStyle`, which works for both the expo-image `Image` and the placeholder `View`s. `addOwnValueErrorMessage` (in `exercise-error-texts.ts`) handles `VocabularyValueError` with the same text as the field issue, so the wording stays in one place. Added the thin routes `app/exercises/[id]/index.tsx`, `app/exercises/[id]/edit.tsx` and `app/exercises/new.tsx`, which were missing. Added the S1-28 link on the Exercises tab, shown once a built-in thumbnail cannot be shown offline (custom photos cannot be downloaded, so they never show it). The link is the shared `DownloadImagesLink` used by the list and the detail gallery. It now closes the stack screens and switches the existing tabs to Settings; the old `router.push` stacked a second tab navigator above the detail. Refactored `useResultLoader` because `react-hooks/set-state-in-effect` flagged it: "loading again" is now worked out during render instead of being set inside the effect, and its existing tests stayed green. Split the four test files that were over 250 lines by `describe` block, with shared helpers moved to `test/support/exercise-{editor,form,detail,library}-harness.tsx` plus `rootStackScreens` in `exercise-screen-harness.tsx`. The test count is unchanged by the split (editor 23, form 21, detail 20, library 22).
- **TDD evidence (seen red first, this session):** `addOwnValueErrorMessage` (3 failing: not a function). The gallery link's "no second tab bar" assertion failed with `push` (`canGoBack` true; root stack `['(tabs)', 'exercises/[id]/index', '(tabs)']`). The Exercises-tab link test failed (no such button). **Tests added after the code** (the code came from the interrupted session, so these went in green): the picker field issue next to its picker, Android back on the delete / discard / photo dialogs, a malformed edit link, the same own value added twice, and discard with no imported photos.
- **Deviations / open issues:** the route files are one-line re-exports and are not unit-tested; they are outside coverage like the existing tab routes. The harness mirrors the route tree. The Settings target of the link is the other agent's section. The Expo Go navigation of the link (Tabs instead of the harness's `Slot`) is for QA to check at S1-26. The pressed-opacity style branches of `ExerciseRow` and `PickerField` and two `useExerciseForm` branches are not covered; every file is above the 85 % presentation threshold.
- **Gates (real output, end of this session):** `npx tsc --noEmit` exit 0. `npm run lint` exit 0. `npm test -- --coverage`: 195 suites / 2 124 tests passed, all files 99.88 % statements / 99.44 % branches / 99.69 % functions / 99.91 % lines, exit 1 **only** because of core-dev's in-progress `src/modules/exercises/infrastructure/exercises.schema.ts` (60 % statements / lines, 0 % functions against its 90 % threshold). Every presentation and `shared/ui` file meets its threshold. Prettier is clean on the ui-dev paths.

### Phase 2 record (core-dev — composition root)

- **Done (integration, 2026-11-17):** the app now wires the whole exercises feature. `createProductionContainer()` = `registerExercises(registerCoreAndUpdates(createContainer()))`; the bootstrapper gets `startupTasks: exercisesStartupTasks(resolver)`, i.e. `exercises.EnsureLibrarySeeded` then `exercises.CleanUpOrphanPhotos`, each resolving its use case only when it runs (creating the bootstrapper still opens no database).
  - `src/core/di/exercise-adapter-registrations.ts` (`registerExerciseAdapters`): `SqliteExerciseReader`, `SqliteExerciseWriter`, `SqliteVocabularyReader`, `SqliteBuiltInImageCatalog`, `SqliteBuiltInLibraryStore` (over `SqliteDatabaseToken`), `createBundledExerciseSeedSource()`, `new SingleFlightImageCache(new ExpoFileSystemImageCache({ imageBaseUrl: seedSource.manifest.imageBaseUrl }))`, `new ExpoPhotoPicker()`, `new ExpoPhotoStore({ idGenerator })` and `ExerciseDataCreditsToken` mapped from `seedSource.manifest.source`.
  - `src/core/di/exercises-registrations.ts` (`registerExercises`, `exercisesStartupTasks`): `createEnsureLibrarySeeded` and the 13 use-case factories, plus `createOfflineImages`. All registrations are lazy singletons (the default), which is required for the memoized seeding, the shared single-flight cache and the `OfflineImages` Observer.
  - Every token a screen resolves with `useDependency` (grep of `src/**/presentation`: Bootstrapper, InstalledAppInfo, the four update tokens, 14 exercises tokens) is resolved from the production container in a test.
  - `app/_layout.tsx` and the routes are unchanged; they already use `createProductionContainer()`.
- **TDD (seen red first):** `exercises-registrations.test.ts` ("Cannot find module './exercises-registrations'"); `exercise-adapter-registrations.test.ts` (written when the 262-line file was split, "Cannot find module"); the new composition-root cases (14 × `No registration for token "exercises.…"`, the background-seeding case found no "Exercise library ready" log, and the orphan photo was still there). After the wiring, the seeding case still failed with `exercises.seedFailed` / `UNIQUE constraint failed: exercises.id`. This was a test-setup bug, not a production bug: the composition-root test mocks `expo-crypto` with one constant UUID. The new end-to-end file gives the mock distinct UUIDs; the original file keeps its constant mock unchanged.
- **Tests:** `exercise-adapter-registrations.test.ts` (each port → adapter; one image cache per container; concurrent downloads of one image make one request to `manifest.imageBaseUrl + path`; photos are named by the IdGenerator; credits come from the manifest). `exercises-registrations.test.ts` (each use case registered; one memoized `EnsureLibrarySeeded`; on-demand images and the bulk download share one in-flight request; one `OfflineImages` per container; `ImportPhoto` end to end through the picker and manipulator stand-ins; task order; tasks resolve nothing until run; tasks run the registered use cases). `composition-root.exercises.test.ts` (the production container over an in-memory better-sqlite3 database: every screen token resolves; after `bootstrap()` the **real bundled seed** is applied in the background (`inserted: 876`) and `FindExercises` lists `manifest.counts.exercises` exercises; an orphan photo is removed). This is the first test that seeds the real 876-exercise asset through the real schema. `composition-root.test.ts` now also mocks `expo-image-picker` / `expo-image-manipulator` with the `test/support` stand-ins. The exercises cases are in a separate file so the original stays under 250 lines.
- **Gates (real output, end of this session):** `npx tsc --noEmit` exit 0. `npm run lint` exit 0. `npm test -- --coverage`: 199 suites / 2 184 tests passed, exit 0; all files 99.96 % statements / 99.44 % branches / 99.9 % functions / 100 % lines; every `src/core/di` file at 100 %. `npx prettier --check src/core/di/ docs/sprints/sprint-1.md`: clean.
- **Notes:** no Phase 1 contract signature changed and no shared type was touched. The background tasks are proven with one `setTimeout(0)` flush, as in `bootstrapper.test.ts`. That works because better-sqlite3 is synchronous and all seeding steps are microtasks. On a device, seeding is slower and the library screen waits on the same memoized promise.

### Resume point (updated 2026-11-17, after the composition-root integration)

- Phase 2 done: core-dev A (domain/application/bootstrap), core-dev B (data infrastructure), core-dev C (device adapters), ui-dev A (library/detail/form), ui-dev B (Settings, offline images, credits), and the **composition-root integration** (record above). The app wires every exercises port, use case, startup task and the data credits. Full gates are green: 199 suites / 2 184 tests.
- **Next:** user review of Phase 2, then Phase 3 (QA: Stryker on `exercises/domain`, Maestro flow S1-25, on-device checks S1-26, ADR-004 to Accepted).
- **Open user decision:** tappable credit links (needs a `UrlOpener` port) or plain text for now.
- **Follow-ups:** FakeOfflineImages controls for estimate failure/pending; EXIF-rotation and Settings-link checks for the S1-26 checklist; duplicated `removeFileQuietly` (architect review).
