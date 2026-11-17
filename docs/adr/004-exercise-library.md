# ADR-004: Exercise library

- **Status:** Proposed (Sprint 1 Phase 1, architect, 2026-11-16). Finalised at the Sprint 1
  close-out after the Phase 2 design review and the on-device checks (S1-26).
- **Date:** 2026-11-16
- **Deciders:** architect; user decisions Q1–Q6 of 2026-11-16 (`docs/sprints/sprint-1.md`
  "Decisions")
- **Amends:** ADR-001 §1 (dependencies), §2 (restricted imports), §8 (Logger contract), §9
  (coverage scope)

## Context

Sprint 1 turns the Exercises tab into a library: ~900 built-in exercises from the open
*free-exercise-db*, offline after the first launch, searchable and filterable, with images; plus
custom exercises with the user's own photos, values and tracked metrics (Q1–Q6). Constraints:
everything runs in **Expo Go on Android** and in the Sprint 0.5 release APK; data is local only;
later modules (routines, workout, history) will reference exercises by `ExerciseId`.

## Decisions

### 1. Dataset: pinned, licence-checked, converted at build time (S1-11, T5)

- **Source:** [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), pinned to
  commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (2026-09-27, latest on `main` on 2026-11-16),
  in `tooling/exercise-db/pin.js`.
- **Licence: data and images may be redistributed and used.** The repository's `LICENSE.md` is
  The Unlicense (public-domain dedication, SPDX `Unlicense`) and covers the whole repository; the
  images are files of that repository (`exercises/<id>/<n>.jpg`) and have no separate licence. The
  README calls it an "Open Public Domain Exercise Dataset" and documents hot-linking the images
  from `raw.githubusercontent.com`. Its own source, `wrkout/exercises.json`, is also Unlicense.
  A verbatim copy is stored at `assets/exercise-db/LICENSE.md`; licence text:
  <https://unlicense.org/>. Residual risk (accepted, user informed): the original authorship of the
  photos cannot be verified independently; we rely on the publishers' dedication. If a takedown
  ever happened, images are not bundled, so a new pin or a removed `imageBaseUrl` stops fetching.
- **Pinned content (exact):** 876 exercises; 1 746 images (873 exercises with 2, 3 with none), all
  JPEG, **98 671 281 bytes ≈ 98.7 MB** in total (average 56.5 KB, largest 919 KB). The PO's "~800"
  and "1 512 images, about 90 MB" are corrected to these numbers.
- **Vocabularies of the pin:** categories (7) cardio, olympic weightlifting, plyometrics,
  powerlifting, stretching, strength, strongman; muscles (17) abdominals, abductors, adductors,
  biceps, calves, chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck,
  quadriceps, shoulders, traps, triceps; equipment (12) bands, barbell, body only, cable,
  dumbbell, e-z curl bar, exercise ball, foam roll, kettlebells, machine, medicine ball, other
  (77 exercises have **no** equipment); levels (3) beginner, intermediate, expert; force (3) pull,
  push, static (30 without); mechanic (2) compound, isolation (87 without). Display labels are
  sentence case ("Body only", A1).
- **Conversion** (`tooling/exercise-db/`, CommonJS + `@ts-check`, 100 % coverage threshold like
  the release scripts): `convert.js` validates every record against `pin.js` and fails on unknown
  vocabulary values, empty primary muscles, duplicate ids, duplicate names (the app's comparison
  rule), images missing from the pinned git tree, or malformed fields — reporting every problem.
  It normalises whitespace, drops blank instruction lines, and removes a secondary muscle that is
  also primary (9 upstream records; reported as notes). Image sizes come from the GitHub git-tree
  listing of the pin (one API call, exact sizes, verified against a real download).
- **Asset** (`assets/exercise-db/`, generated, excluded from Prettier): `exercises.json` (compact
  JSON: format version, seed version, built-in vocabularies with labels, exercises sorted by source
  key; **919 KB**, 174 KB gzipped; no images) and `manifest.json` (642 B: seed version, SHA-256
  content hash, pinned source and licence, `imageBaseUrl`, counts). The seed version starts at 1,
  stays when the content hash is unchanged and increments when it changed (tested: "strictly
  greater"); a malformed existing manifest fails the script rather than restarting at 1.
- **Name comparison is implemented twice, on purpose:** in the converter (Node, build time) and in
  the domain (`comparisonKey`, S1-08). Both use the same explicit combining-mark class (not `\p{M}`,
  to be safe on Hermes) and are pinned by the same examples, like the release format in ADR-003.

### 2. Data model and tables (S1-04, S1-14, T4, T7)

- **Aggregate:** `Exercise = BuiltInExercise | CustomExercise` (discriminated on `origin`;
  `isCustom` derived). Built-ins carry `sourceKey`, level, force, mechanic and dataset images;
  custom exercises carry app-owned photos. Both have name, category, primary/secondary muscles,
  equipment (nullable), instructions (steps), tracked metrics (canonical order) and `archived`.
  No timestamps in Sprint 1 (no AC needs them; YAGNI).
- **Vocabulary values are value objects identified by `(kind, comparisonKey(label))`.** Exercises
  store the **keys**; labels live in the vocabulary table. Built-in and user-defined values share
  one table with the origin in the primary key, so equal keys from both origins can coexist.
- **Tables owned by `exercises`** (one `exercises.schema.ts`, drizzle-kit migration, S1-04):

  | Table | Columns |
  |---|---|
  | `exercises` | `id` text PK; `origin` text (`builtIn`/`custom`); `source_key` text, unique, null for custom; `name` text; `name_key` text, indexed (uniqueness lookup); `category` text; `equipment` text null; `level`, `force`, `mechanic` text null; `primary_muscles`, `secondary_muscles`, `instructions`, `images`, `tracked_metrics` text (JSON arrays); `archived` integer boolean, default 0, indexed |
  | `exercise_vocabulary_values` | `kind`, `key`, `origin`, `label`; PK (`kind`, `key`, `origin`) |
  | `exercise_library_seed` | `id` integer PK (single row, always 1); `seed_version` integer |

  **JSON columns instead of join tables:** search and filters run in memory (decision 4), so no
  query needs SQL over list members; a whole exercise is one row, written atomically, and list
  order round-trips trivially. Mappers validate the JSON on read (Data Mapper); a corrupt row is an
  `exercises.storageFailed`, never a crash.
- **No database unique constraint on names** (T9): uniqueness is a user-facing rule of the
  create/edit use cases (Q6), and a re-seed may legitimately bring a built-in whose name equals a
  custom exercise's; both are kept and told apart by the "Custom" badge.

### 3. Seeding: idempotent, versioned, after the tabs appear (S1-12, S1-13, T2)

- `EnsureLibrarySeeded` compares the manifest's seed version (tiny file, read synchronously) with
  `exercise_library_seed.seed_version`. Equal → nothing is read or written. Stored higher
  (downgrade, branch switch) → nothing changes. Lower or none → the seed source lazily loads and
  validates `exercises.json` (`require` inside the adapter method, so later launches never parse
  the 0.9 MB seed), the domain's `planLibrarySeed` computes inserts / in-place updates by
  `sourceKey` (ids never change) / archives (built-ins no longer in the seed are hidden, never
  deleted) / built-in vocabulary upserts, and the store applies the plan **plus the new version in
  one transaction**. An interrupted run leaves the previous state; the next run completes it.
  Custom exercises, their photos and user-defined values are never read or written by seeding.
- **Non-blocking (S1-13): the tabs appear first.** The bootstrapper resolves `ok` after the
  migrations and then runs **startup tasks** in the background (new `StartupTask` contract in
  `src/core/bootstrap/startup-task.ts`): `EnsureLibrarySeeded`, then `CleanUpOrphanPhotos`. Every
  library use case awaits `EnsureLibrarySeeded` (a **memoizing proxy with retry**: one run at a
  time, the successful result cached, a failed run retried on the next call), so the Exercises
  tab shows its loading state until the library is ready, an error with **Retry** if seeding
  failed (A9: never a partial library), and the other tabs are unaffected.
  Rejected: seeding inside the bootstrap sequence. It would need a device measurement before we
  could promise the 500 ms budget, and a seeding failure would then block the whole app.
- Risk to measure (S1-26): the first-launch transaction is synchronous on the JS thread
  (expo-sqlite sync API, ~876 rows in batches); a short freeze right after the tabs appear is
  possible. If QA finds it noticeable, the store moves to the async expo-sqlite transaction API
  behind the same port.

### 4. Search, filter and sort: pure domain functions in memory (S1-09, S1-15, T1)

`findMatchingExercises` in `exercises/domain/exercise-query.ts` composes one **Specification**
per facet (text: every word is a substring of the comparison key of the name; muscle (primary
only, A4), equipment, category: OR within, AND across) and sorts by comparison key, ties by id.
`FindExercises` reads the active summaries (~880 small rows) per query and applies it. No SQL
`LIKE`, no FTS: the rules stay in one tested place and accent folding works the same everywhere.
If the device shows more than 300 ms from keystroke to results, a caching **Decorator** around
`ExerciseReader` (invalidated by writes) is added without touching the use case.

### 5. Built-in images: explicit download into app document storage (S1-18, S1-28, T3, T8)

- **Cache = files under `Paths.document/exercise-images/<dataset path>`**, written by an
  expo-file-system adapter (`File.downloadFileAsync` into a temporary file, then `move` into place;
  partial files removed on failure or cancel). Presentation receives `file://` URIs from
  `GetExerciseImage` and shows them with `expo-image` (`cachePolicy="memory"`); it never sees a
  remote URL (lint forbids network globals and the seed asset in presentation).
- **Rejected: expo-image's own disk cache** (`cachePolicy="disk"` + `Image.prefetch`). It lives in
  the cache directory (Android may clear it, which would undo a completed bulk download), Glide
  caps it at about 250 MB by default and evicts, and it offers no per-image progress, cancel or
  "is this cached?" listing, which S1-28 needs.
- One cache for both paths: the `SingleFlightImageCache` **Decorator** (application) shares an
  in-flight download between the list/detail and the bulk run, so an image is never downloaded
  twice. Cancelling a shared task cancels it for both; the on-demand view then shows the
  placeholder and retries the next time it is shown.
- **URL:** `manifest.imageBaseUrl + path`, i.e.
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/<pinned commit>/exercises/<path>`
  (configuration generated from `pin.js`, injected into the adapter by the composition root).
  Cache files are keyed by dataset path only, so a later pin re-uses them (a changed upstream image
  under the same path is not re-downloaded; acceptable).
- **Offline:** never-cached image or failed download → placeholder "Image not available offline";
  the next view online retries. Thumbnails are requested only by visible rows (list virtualisation).
- **Bulk download (S1-28, T8):** placement **Settings → "Offline images"**, rendered by the
  `OfflineImagesSection` component exported by `exercises` (the download belongs to `exercises`;
  Settings only renders it); the detail screen's image placeholder links to it. The confirmation
  shows the missing count and the **exact** sum of their sizes from the seed metadata (labelled
  "about", e.g. "1 746 images, about 99 MB. Use Wi-Fi if you can."). Concurrency
  **4**. After **5 consecutive failures** the run ends early with a summary (lost connection),
  instead of retrying forever; "Retry failed" = start again (only missing images are fetched).
  The run is a singleton service (**Observer** + state machine) living as long as the JS process:
  it continues across screens; there is **no background continuation** (Expo Go has no background
  task for this). If Android suspends or kills the app, finished images are kept and the user
  restarts the download; the section says "Keep the app open until the download finishes. Images
  downloaded so far are kept."
- **Space:** a full download adds ~99 MB to app document storage. Consequence for Sprint 6: an APK
  with Android Auto Backup enabled stops backing up entirely above 25 MB, so the image folder must
  be excluded from Auto Backup (or Auto Backup disabled) when backup is designed (backlog).

### 6. Custom exercises: rules in the domain, uniqueness in the use cases (S1-08, S1-19 to S1-23, T9)

- `validateExerciseDraft` returns **every** field issue at once (`exercises.invalidExercise` with
  `issues[]`). Limits: name 80, instructions 5 000 characters in total, 6 photos, vocabulary value
  40, at least one primary muscle, at least one tracked metric, category required, equipment
  optional (the dataset itself has exercises without equipment; A2 refined).
- **Name uniqueness (Q6)** is checked by `CreateCustomExercise` / `UpdateCustomExercise` through
  `ExerciseReader.findActiveByNameKey(comparisonKey(name), excluding)` against all active built-in
  and custom exercises; archived ones never block a name. A conflict becomes an
  `exercises.duplicateName` issue next to the name field, naming the existing exercise.
- **User-defined values (Q5, T7)** are chosen in the form as `{ source: 'new', label }` and
  resolved by the domain on save: equal to an existing value of that kind → that value; otherwise a
  new `custom` value, persisted **in the same transaction** as the exercise (a discarded form
  leaves nothing). The picker previews the resolution with `ResolveVocabularyValue` (no write).
- **Re-seed collisions (T9):** a new built-in **name** equal to a custom one → both kept, nothing
  renamed. A new built-in **value** equal to a user-defined one → both rows kept (no data lost);
  `mergeVocabulary` shows one entry per key with the built-in label and origin; exercises store the
  key, so none changes meaning. Built-in values are never deleted by later seeds.
- **Delete = archive (Q1):** hidden everywhere, readable by id with `includeArchived` (future
  routines/history), photo files deleted immediately, name free again, used values stay.
- **Duplicate as custom (Q2, A10):** prefill from the built-in, no images, name from the pure
  `suggestDuplicateName` ("(custom)", "(custom 2)" … within 80 characters).
- **Forward compatibility (S1-20):** changing tracked metrics changes only the definition; Sprint
  3/4 logs store their own values, so past logs never change.

### 7. Custom photos: app-owned copies (S1-22, T6)

- Two ports: `PhotoPicker` (expo-image-picker: camera / photo library, permissions, cancel) and
  `PhotoStore` (expo-image-manipulator + expo-file-system: downscale so the longest side is at most
  **1 600 px**, JPEG quality **0.8**, store under `Paths.document/exercise-photos/<id>.jpg`). The
  database stores file names only, never picker or gallery URIs, so photos survive the original
  being deleted and the app document path changing between installs.
- Removed photos are deleted after a successful save; a discarded form's new photos are deleted
  by `DiscardPhotos`, which never deletes a file an active exercise refers to.
- **Orphan cleanup** at startup (background task): list files, then read referenced names, then
  delete the difference — a photo imported after the listing can never be removed.

### 8. Dependencies (all part of Expo Go; no development build)

| Package | Use | Expo Go |
|---|---|---|
| `expo-image` ~58.0.18 | gallery and thumbnails from local `file://` URIs (presentation) | included |
| `expo-image-picker` ~58.0.10 (+ config plugin: camera/photos texts, `microphonePermission: false`) | camera and gallery (infrastructure adapter) | included |
| `expo-image-manipulator` ~58.0.16 | downscale/compress photos (infrastructure adapter) | included |
| `@expo/vector-icons` ^15.0.2 | tab bar icons (S1-05) | included |
| `expo-font` ~58.0.12, `expo-asset` ~58.0.21 | required peers of `@expo/vector-icons` / `expo-font`; installed directly because npm nested `expo-asset` under `expo`, where `expo-font` cannot resolve it (Jest failed with "Cannot find module 'expo-asset'") | included |
| `expo-file-system` (already present) | image cache and photo store | included |

`npx expo-doctor`: 20/20. The image-picker plugin adds `CAMERA` (and storage permissions up to
API 32) to the release manifest; the release APK check only requires `REQUEST_INSTALL_PACKAGES`
and still passes. Lint: `expo-image-manipulator` joined the device-service list (forbidden in
presentation, like `expo-image-picker` and `expo-file-system`); `expo-image` and
`@expo/vector-icons` are allowed in presentation; `@assets/exercise-db/*` is forbidden in domain,
application and presentation (only the seed source adapter reads it).

### 9. Patterns and why

| Pattern | Where | Problem it solves here |
|---|---|---|
| **Repository + Data Mapper** | `ExerciseReader` / `ExerciseWriter` / `VocabularyReader` / `BuiltInImageCatalog` / `BuiltInLibraryStore` (SQLite adapters, row ⇄ domain mappers) | use cases are tested with in-memory fakes; the same contract suites prove the SQLite adapters equivalent (Liskov); JSON columns never leak out |
| **Interface Segregation** of the repository | five small ports instead of one `ExerciseRepository` | browsing, CRUD, seeding and the bulk download have different consumers and different fakes |
| **Specification** | facet predicates in `exercise-query.ts` | one named predicate per filter; OR within a facet, AND across; new filters are added without editing the others |
| **Strategy / rule table** | `defaultTrackedMetrics` (`DEFAULT_METRIC_RULES`) | the Q3 table is data, tested row by row, not `if` chains |
| **Registry** | `TRACKED_METRICS` | adding a metric is one entry (Open/Closed) |
| **Value Object** | vocabulary values `(kind, key)`, `ComparisonKey`, branded paths and file names | equal-by-key semantics make the re-seed merge and the "same name" rule one function |
| **Adapter** | seed source (asset), image cache (expo-file-system), photo picker (expo-image-picker), photo store (expo-image-manipulator + expo-file-system) | Expo and the bundled asset stay behind ports; adapters are tested with the native boundary mocked |
| **Decorator** | `SingleFlightImageCache` (in-flight de-duplication); future caching reader if needed | on-demand and bulk share downloads without either knowing about the other |
| **Memoizing proxy with retry** | `EnsureLibrarySeeded` | one seeding run however many screens ask; Retry is simply "call again" |
| **Observer + State machine** | `OfflineImages` (`subscribe`, `OfflineImagesState`) | the Settings section, and any later screen, follow one run without polling; illegal states are unrepresentable |
| **Unit of Work (single port method)** | `ExerciseWriter.saveCustom(exercise, newValues)`, `BuiltInLibraryStore.applySeed(plan)` | the multi-table writes that must be atomic are one transaction inside one adapter call; no general Unit of Work abstraction yet (YAGNI) |
| **Background startup task** | `StartupTask` in the bootstrapper | seeding and cleanup run after startup without the bootstrap sequence knowing about exercises |
| **MVVM** | library, detail, form and offline-images screens with view-model hooks (ui-dev) | screens render; behaviour is tested through hooks |

## Consequences

- First launch: tabs immediately, Exercises shows a loading state until seeding is done (device
  time measured by QA). Later launches: one indexed single-row read.
- The bundle grows by ~0.9 MB (seed). Images need the network once (or the bulk download).
- Updating the dataset is a deliberate pin change + re-run; unknown values fail the converter
  until `pin.js` (and possibly the S1-10 rule table) is updated.
- Later modules reference exercises only by `ExerciseId`; archived exercises remain readable.
- Open until the close-out: device timings (seeding, search), first device run of the camera and
  permission flows, the auto-backup exclusion (Sprint 6).
