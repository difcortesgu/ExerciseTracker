# ADR-003: Release builds and self-update

- **Status:** Accepted (Sprint 0.5 close-out, architect, after the Phase 2 design review and the
  Phase 3 QA report). Still to be confirmed in practice: the first real release run on GitHub and
  the on-device check S05-14; findings from them amend this ADR.
- **Date:** 2026-11-14
- **Deciders:** architect; user decisions of 2026-11-13 (`docs/sprints/sprint-0.5.md` "Decisions")
- **Amends:** ADR-001 §1 (dependencies; transitive reanimated/worklets clarified), §2 (restricted
  imports and globals), §9 (coverage scope)

## Context

The user wants every push to `main` to produce an installable APK, and the installed app to
offer newer builds itself (sprint 0.5 goal). Constraints: no EAS and no Expo account; one fixed
signing key held in four repository secrets; ask before downloading; Android's system installer
always asks for confirmation; development in Expo Go must keep working unchanged
(ADR-001 §1: no dependency may need a development build).

## Decisions

### 1. GitHub Actions + Gradle, not EAS

The release APK is built on a GitHub-hosted Ubuntu runner with `expo prebuild` and
`./gradlew assembleRelease`. EAS Build would need an Expo account and token (rejected by the
user) and would put the build and the signing key in a third-party service. GitHub-hosted
runners already have the Android SDK and build tools; we add JDK 17 (`actions/setup-java`,
Temurin) and Gradle caching (`gradle/actions/setup-gradle`). Cost: a release run takes about
10–20 minutes, and we own the build configuration.

### 2. Native project: Continuous Native Generation in CI

`android/` is **generated in CI** by `npx expo prebuild --platform android --clean --no-install`
and never committed (`/android` is git-ignored, and lint/Prettier/tsc ignore it). All native
configuration stays in `app.json` + `app.config.js`, so there is one source of truth and nothing
that can drift from Expo Go.

- `app.config.js` (new) applies `tooling/release/app-config.js` to `app.json`: when CI sets
  `APP_BUILD_NUMBER`, it sets `android.versionCode`; without it (Expo Go, local development) the
  static config is returned **unchanged** (same object, tested). An invalid value throws, so a
  wrong `versionCode` can never be built.
- `expo-doctor` runs in the quality job on the repository (no `android/` folder), 20/20 passing
  with the new config. Prebuild also rewrites the `android` script in `package.json` on the
  runner; that change exists only in the CI workspace and is never committed.
- Verified locally in a scratch copy: prebuild with `APP_BUILD_NUMBER=42` writes `versionCode 42`,
  `versionName "0.1.0"`, `applicationId 'com.farid.exercisetracker'` and the
  `REQUEST_INSTALL_PACKAGES` permission into the generated project (Gradle 9.4.1, AGP 9.x).
- Verified locally end to end (scratch copy, throwaway keystore, Android Studio JDK 25 instead of
  CI's JDK 17): `assembleRelease` with the injected signing properties succeeded in about 10 min
  (31 MB APK for `arm64-v8a`). `apksigner` shows the throwaway certificate (not the debug key), and
  `verify-certificate` / `verify-apk` pass on the real APK and fail for a wrong fingerprint. That
  run found a bug: for a v2-only APK (minSdk 24), `apksigner` prints `V2 Signer: certificate
  SHA-256 digest:`, not `Signer #1 …`. It was fixed test-first, using the real output as a test case.

### 3. Signing without committing secrets

- The four secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`) are exposed only to the steps that need them (`env:` per step).
- The keystore is decoded into `$RUNNER_TEMP` (outside the workspace, mode 600), used by Gradle and
  deleted in an `if: always()` step. It is never uploaded as an artefact. GitHub masks secret
  values in logs; no step echoes them; the settings check prints names only (tested).
- The write token (`contents: write`) exists only in the release job and is passed as `GH_TOKEN`
  only to the two `gh` steps (publish, remove draft). Checkouts that don't need git credentials use
  `persist-credentials: false`, so `npm ci` lifecycle scripts, prebuild and Gradle plugins can't
  read a token from the environment or `.git/config` (QA-05-4). "Plan release" keeps the read-only
  token, which `git ls-remote --tags` uses.
- Gradle signs with the Android Gradle Plugin's **injected signing properties**
  (`-Pandroid.injected.signing.store.file/.store.password/.key.alias/.key.password`, the mechanism
  Android Studio uses). They override the signing config of every built variant, so the generated
  `build.gradle` (whose release type signs with the debug key) is not edited by a string-patching
  config plugin, which would break whenever the Expo template changes. Trade-off: the passwords
  are process arguments on the ephemeral runner VM (not in logs).
- **Proof that the right key was used:** `apksigner verify --print-certs` must succeed, report
  exactly one signer, and that signer's SHA-256 must equal the repository **variable**
  `ANDROID_CERT_SHA256` (public information; a variable keeps it readable in logs). A debug or
  generated key fails this check, and nothing is published. A missing or blank secret or variable
  fails the release-plan job with an `::error::` naming each one, before anything is built.
- `aapt2 dump badging` must show package `com.farid.exercisetracker`, `versionCode` = build
  number, `versionName` = `expo.version` (unchanged, Q2) and `REQUEST_INSTALL_PACKAGES`.

### 4. Build number

**Build number = `github.run_number` of the CI workflow + `BUILD_NUMBER_OFFSET`** (optional
repository variable, default 0). It is the APK's `versionCode`, the number in the release tag, and
what the app compares.

| Situation | Why the number stays strictly increasing and is never reused |
|---|---|
| Two pushes in a row | Each new run gets the next `run_number` (assigned when the run is created, per workflow, across all branches and PRs; gaps are fine). |
| Quick succession on `main` | Workflow concurrency does **not** cancel in-progress runs on `main`; runs queue, so release jobs run one at a time in push order. A queued run may be replaced by a newer one (it never publishes). |
| Cancelled or failed run | Its number is used up but never published: a gap. The draft release, if any, is deleted (`if: failure() \|\| cancelled()`). |
| Re-run of a run | Re-runs keep `run_number`. The plan step lists remote tags (`git ls-remote --tags`) and publishes only if the number is **greater than every `build-<n>` tag**: an already published number → `::notice::`, skip; an older number after a newer release → `::warning::`, skip. So "latest" always has the highest number. |
| Counter reset (workflow file renamed/recreated) | The plan step refuses to publish (warning) until `BUILD_NUMBER_OFFSET` is raised above the last published build. |

Limits: 1 to 2 100 000 000 (Android's maximum `versionCode`); checked in the CLI and the app.

**At runtime** the app reads its build number from the native app info
(`expo-application` `nativeBuildVersion`, which is the `versionCode` on Android) through the
`InstalledAppInfo` port (section 7). No value is injected into the JS bundle, so the number the app
shows is by construction the APK's `versionCode`.

### 5. Release format (the contract the app relies on)

| Field | Format | Example |
|---|---|---|
| Tag | `build-<n>`, n without leading zeros | `build-42` |
| Title | `Build <n>` | `Build 42` |
| Asset | exactly one `.apk`: `exercise-tracker-build-<n>.apk` | |
| Notes | build, full commit SHA, commit subject, link to the workflow run | |
| State | published (not draft, not pre-release), marked latest | |

- Publishing is atomic from the app's point of view: `gh release create --draft` with the APK
  (drafts have no tag), then `gh release edit --draft=false --latest`. A release is never visible
  without its APK, and no tag exists for an unpublished build.
- The app reads `GET https://api.github.com/repos/difcortesgu/ExerciseTracker/releases/latest`
  (unauthenticated; excludes drafts and pre-releases), uses `tag_name`, and for each asset `name`,
  `browser_download_url` and `size`.
- The rules exist twice, in `tooling/release/release-format.js` (Node, CI) and in
  `src/modules/updates/domain` (TypeScript, app), because two runtimes cannot share one module.
  This table is the single specification; both sides are pinned by tests with the same examples.
- All releases are kept (Q5, assumed).

### 6. Module placement: new feature module `updates`

Self-update is a feature with its own domain rules (release parsing, update decision), use cases,
three adapters and UI, so it is a **feature module** `src/modules/updates/` with the usual four
layers and a public `index.ts`. Rejected: `src/core` (core is wiring and the app shell, and has no
domain/application layers or per-layer thresholds); `settings` (would mix two reasons to change).

- **No boundary-policy change is needed**: the element descriptors are generic over
  `src/modules/*`, so `updates` gets all layer and module rules automatically.
- The startup dialog is rendered by `app/_layout.tsx` (the `app` element may import module public
  APIs) **inside** `AppBootstrapGate`'s children. The gate renders children only after a
  successful startup, so the dialog can never appear over the startup failure screen (Q6) by
  construction, and `src/core/presentation` does not need to depend on a feature module.
- *Close-out (QA-05-3):* route files can't have tests (expo-router would bundle them as routes),
  so the root composition moved into `AppShell` (`src/core/presentation/app-shell.tsx`: DI
  provider, status bar, startup gate). It takes the routes as `children` and feature UI as an
  `overlay` slot rendered inside the gate; its test proves the overlay never shows while starting
  or over the failure screen. `app/_layout.tsx` only passes `<Slot />` and `<UpdatePrompt />`.
  Rejected: letting tests import `app/` (the layout creates the production container at module
  load, so the test would have to mock the composition root) and moving the composition into a
  feature-aware place under `src/core` (core would depend on `updates`).
- **Shared kernel:** "which build is running" is used by `updates` (S05-06) and `settings`
  (S05-11), and is not an update concern, so `BuildNumber` and `InstalledApp` live in
  `src/shared/domain`, the `InstalledAppInfo` port in `src/shared/application`, and its Expo
  adapter in `src/shared/infrastructure/app-info/`. `settings` therefore does not depend on
  `updates`. Presentation resolves this read-only port directly through `useDependency` (allowed
  by ADR-001 §2); wrapping it in a pass-through use case would add nothing (YAGNI).

### 7. Detecting "Expo Go / development build → updater inactive"

The `ExpoInstalledAppInfo` adapter returns `development` when
`Constants.executionEnvironment === ExecutionEnvironment.StoreClient` (Expo Go or an
`expo-dev-client` build) **or** the bundle runs in dev mode (`__DEV__`). Otherwise it returns
`release` with the build number parsed from `nativeBuildVersion`. Expo Go's own native version is
never read as ours. A release whose build number cannot be parsed reports `development` and logs a
warning (fail-safe: no wrong offer). The `CheckForUpdate` use case returns `inactive` for
`development` without calling the release source (no network request).

### 8. Permissions and native modules (Expo Go impact)

| Addition | Why | Expo Go |
|---|---|---|
| `android.permission.REQUEST_INSTALL_PACKAGES` (`app.json` `android.permissions`) | Since Android 8, an app may only open the package installer for an APK if it declares this; Android then asks the user once to allow "Install unknown apps" for Exercise Tracker | ignored (Expo Go uses its own manifest); applied by prebuild only |
| `expo-application` | `nativeBuildVersion` / `nativeApplicationVersion` | included in Expo Go |
| `expo-file-system` | download with `onProgress` and `AbortSignal` (`File.createDownloadTask`/`downloadFileAsync`), `File.contentUri` through its own `FileProvider` | included in Expo Go |
| `expo-intent-launcher` | `startActivityAsync('android.intent.action.VIEW', { data: contentUri, type: 'application/vnd.android.package-archive', flags: FLAG_GRANT_READ_URI_PERMISSION })` opens the system installer and resolves when the user returns | included in Expo Go |
| `expo-constants` (already a dependency) | `executionEnvironment` | included in Expo Go |

**No dependency needs a development build**; ADR-001 §1 still holds. All four packages are
installed with SDK-58-compatible versions (`npx expo install --check`: up to date).
Lint now forbids `expo-application`, `expo-constants` and `expo-intent-launcher` (besides the
already listed `expo-file-system`) in presentation, and the `fetch`, `XMLHttpRequest` and
`WebSocket` globals in domain, application and presentation (rule tests in `tooling/eslint`).

### 9. Integrity and safety of the update

- Download URL: `https://` and host exactly `github.com` (the `browser_download_url` host; the
  native downloader follows GitHub's redirect to its asset CDN). Parsed with anchored regular
  expressions in the domain, not with the `URL` global (React Native's polyfill differs by version).
- Size: the completed file must equal the release's `size`, else it is deleted and reported as a
  failed download.
- Signature: Android only installs an update signed with the **same certificate** as the installed
  app, so a tampered APK cannot replace it. No extra checksum is needed (YAGNI).
- The app never installs silently; the user confirms in Android's dialog every time.
- At most one release request per launch (GitHub's unauthenticated limit is 60/hour/IP).
- Timeout of the release request: 10 s (`RELEASE_CHECK_TIMEOUT_MS`). The download has no total
  timeout (a 30–40 MB APK on mobile data can take minutes); it fails on network errors and the user
  can cancel.

### 10. Release CI scripts are code, developed test-first

All decisions of the release jobs live in `tooling/release/` (CommonJS, `// @ts-check`, typed via
JSDoc and checked by `tsc` through their TS tests): build number, release plan, release notes,
settings check, certificate check, APK identity check, and the Expo config hook. The workflow only
wires them through one CLI. They are measured with a **100%** threshold (`coverage-policy.js`,
guarded by `coverage-policy.test.ts` and `coverage-config.test.ts`); the 10-line process entry
`release-cli.js` is excluded and covered by a spawned-process test.

ABIs: the release APK contains `arm64-v8a` and `armeabi-v7a` (every real Android phone), not the
x86 emulator ABIs, which keeps it smaller and the build faster. Emulators use Expo Go.

### 11. Patterns

| Pattern | Where | Problem it solves here |
|---|---|---|
| **Adapter** (ports & adapters) | `GitHubReleaseSource`, `ExpoApkDownloader`, `IntentApkInstaller`, `ExpoInstalledAppInfo` | HTTP, files, intents and native app info stay out of domain/application; use cases are tested with fakes, adapters with the native boundary mocked |
| **Contract tests** (Liskov) | `test/contracts/{release-source,apk-downloader,apk-installer,installed-app-info}.contract.ts` | the fakes the use cases are tested with behave exactly like the real adapters (the installer suite was added by core-dev beyond the plan) |
| **Guard / inactive outcome** (instead of a Null Object) | `CheckForUpdate` returns `inactive` for `development` | one decision point, provable with fakes ("no request in Expo Go"); a Null Object chosen in the composition root would hide the runtime-environment branch in wiring code that has no tests at that level |
| **Memoizing proxy** ("once per launch") | `createCheckForUpdate` caches its first promise | the at-most-one-request rule holds regardless of re-renders, remounts or a second consumer. It covers the **request** only, not the user's answer (QA-05-1) |
| **Process-scoped store** (singleton per container, not persisted) | `UpdateOfferDismissal` (`updates/application/update-offer-dismissal.ts`), registered in the composition root | the prompt's state machine lives in a component; the store keeps "Later" / cancel / close for the whole process, so a remount of the root layout (Android 11 and older keep the JS runtime after Back) does not offer again, while the next launch (new container) does (S05-08) |
| **State machine** (discriminated union + reducer) | update-flow view model in `updates/presentation` | offered → downloading → failed/ready → installing → dismissed without boolean soup; each transition tested |
| **MVVM** | `UpdatePrompt` + `useUpdateFlow`; Settings + `useAppVersion` | screens render; behaviour is tested through the hooks |
| **Presenter** (pure formatting functions) | `updates/presentation/update-texts.ts`, `settings/presentation/app-version-label.ts` | display strings (MB, percent, error texts) stay out of components and are unit tested; no update rule lives there |
| **Slot composition** | `AppShell` `overlay` prop | the gate's "only after startup" guarantee is tested once, without core depending on a feature module |
| **Command + Registry** | `tooling/release/cli.js` `COMMANDS` | each CI step is one tested handler; adding a check adds an entry, no switch |
| **Result** | every port and use case | offline, rate limits, bad releases and cancelled downloads are expected; nothing throws into the UI |

## Consequences

- Every push to `main` that passes the gates publishes "Build N" once the user has configured the
  four secrets and `ANDROID_CERT_SHA256`; until then, the release-plan job fails with a clear
  message (by design: no unsigned or debug-signed APK is ever published).
- Losing the keystore means no further update can install over the existing app (README, S05-12).
- Branch and PR runs consume build numbers too (gaps only).
- Release runs on `main` queue instead of being cancelled; a burst of pushes publishes the newest
  commit after the running one.
- Native code of `react-native-reanimated` and `react-native-worklets` (transitive, autolinked)
  is in the APK although the app doesn't use it; accepted (ADR-001 §1), size check in the backlog.
- Not verified yet: a real GitHub Actions release run, and the on-device install-over (S05-14).
