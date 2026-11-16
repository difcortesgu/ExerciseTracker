# Sprint 0.5 — Continuous delivery & self-update

**Status:** done — awaiting user review (pending: first real CI run and on-device S05-14).
**History:** Phase 1 (architect), Phase 2 (core-dev, ui-dev) and Phase 3 (QA) done on 2026-11-14; QA-05-1 fixed by ui-dev; architect close-out on 2026-11-14 (README S05-12, CI hardening, QA-05-3 test, design review, ADR-003 accepted). See "QA report" and "Architect design review (close-out)" at the end.
**Source:** user request of 2026-11-13 (quoted below) and the decisions listed under "Decisions"; `PLAN.md` §5 "Sprint 0.5"; rules in `docs/ENGINEERING_STANDARDS.md`.

> "when something is pushed to main it should create the apk so that I can install it on my phone and test it, also I want the app to be able to update itself so at the start it should check if there is a new release on github and if so download it and install it"

## Sprint goal

Every push to `main` that passes the quality gates produces a **signed release APK**, published as a **GitHub Release** on `difcortesgu/ExerciseTracker`. Once installed, the app **offers newer builds itself** at startup: it asks first, downloads with visible progress and hands the APK to Android's system installer. The user always confirms the install. Development in Expo Go keeps working unchanged.

## Sprint demo criteria

1. A push to `main` runs the quality gates (typecheck, lint, format, tests with coverage, expo-doctor) and then publishes a GitHub Release "Build N" with one signed APK attached.
2. That APK is installed on an Android phone by downloading it from the release page (first install, with the one-time "install unknown apps" permission for the browser or file manager).
3. A second push to `main` publishes "Build N+1". When the installed app is opened, it shows "Build N+1 available – Update / Later". **Update** shows download progress, then opens Android's installer. The user confirms, and the app then runs build N+1 (visible in Settings) **without losing app data**.
4. Opening the app offline, or tapping **Later**, shows the tabs normally with no crash. The app offers the update again on the next launch.
5. The same project still opens in **Expo Go** with no update dialog.

Also shown at the review:
- the workflow definition and run history showing that the release job only runs after every gate passes, and only for pushes to `main`;
- `npx tsc --noEmit`, `npm run lint`, `npm test -- --coverage` results (real output);
- ADR-003 and the README sections from S05-12.

## Conventions used in this file

- **Module** says where the story lives: `tooling` (CI, build config), `docs`, `app`, or **`updates`**. `updates` is a placeholder name for wherever the self-update feature lives. Choosing it (a new feature module, `src/core`, or something else) is an **architect decision** (see "Open questions"), because a new module means a change to the boundary policy.
- Each acceptance criterion (AC) is written as Given/When/Then so it can become an automated test or a repeatable check before implementation starts.
- **CI ACs** (S05-01 to S05-04) are verified by real GitHub Actions runs. Any logic pulled out of the workflow into a script (for example computing the build number or the release notes) is developed test-first like any other code.
- **On-device ACs** (installer, permission prompts, install-over) can't run in Jest. They are covered by the S05-14 checklist. Everything up to the hand-off to Android is automated with fakes at the port boundary.
- "Latest release" means the newest **published** release: drafts and pre-releases never count.
- Implementation choices (libraries, file names, module placement, how signing and the build number are wired, prebuild strategy) belong to the architect unless an AC states them.

---

## Stories

### A. Delivery pipeline (architect)

#### S05-01 — Monotonically increasing build number
**Module:** tooling
As the user, I want every build to carry a build number that only ever goes up, so that Android accepts each new APK as an update and the app can tell which build is newer.

- **Given** two successful pushes to `main`, one after the other, **When** both release builds finish, **Then** the second APK's Android `versionCode` is strictly greater than the first's.
- **Given** two pushes to `main` in quick succession (the first run may be cancelled or still running), **When** the runs finish, **Then** no two published releases share a build number, and the release marked "latest" has the highest one.
- **Given** a release APK, **When** the app runs from it, **Then** the app can read its own build number at runtime, and it equals the APK's `versionCode` and the build number of the release it was published in.
- **Given** a published release, **When** it is read through the GitHub API, **Then** its build number can be read from it in a machine-readable way (for example from the tag), using a format documented in ADR-003.
- **Given** the user-visible version (`expo.version`, currently `0.1.0`), **When** a build is made, **Then** it is left as it is. Only the build number changes per build (see open question Q2).

#### S05-02 — Signed release APK built in CI
**Module:** tooling
As the user, I want CI to build a release APK signed with my one fixed key, so that every new build installs over the previous one.

- **Given** a push to `main` where every quality gate has passed, **When** the release job runs, **Then** it builds a release APK with Gradle on GitHub Actions, with no EAS and no Expo account or token.
- **Given** the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`, **When** the APK is built, **Then** it is signed with that keystore and key, and **not** with a debug or auto-generated key.
- **Given** the built APK, **When** CI verifies it (for example with `apksigner verify`), **Then** the signature is valid, and the signing certificate's SHA-256 fingerprint equals the expected fingerprint configured in the repository. A mismatch fails the job and nothing is published. (The fingerprint is public information. The user provides it, see "User actions".)
- **Given** one or more of the four secrets is missing or empty, **When** the release job runs, **Then** it fails with a message naming the missing secret, and no unsigned or debug-signed APK is published.
- **Given** the repository and the CI logs, **When** they are inspected, **Then** the keystore file, its base64 form and the passwords appear in neither: the keystore is not committed, the decoded keystore exists only during the job and is not uploaded as an artefact, and secret values are masked.
- **Given** the APK package name, **When** it is inspected, **Then** it is `com.farid.exercisetracker` (sprint 0 decision 7), so the release app is installed next to Expo Go, not instead of it.

#### S05-03 — Publish a GitHub Release on every push to `main`
**Module:** tooling
As the user, I want each passing push to `main` to become a GitHub Release with the APK attached, so that I can install it on my phone and the app can find it.

- **Given** a push to `main` where all gates pass and the APK was built and verified, **When** the workflow finishes, **Then** a new published release (not a draft, not a pre-release) exists on `difcortesgu/ExerciseTracker`, titled with its build number (e.g. "Build 42"), with **exactly one** `.apk` asset attached.
- **Given** that release, **When** it is read, **Then** its notes contain at least the commit SHA it was built from and that commit's subject line.
- **Given** a push to `main` where **any** gate fails (typecheck, lint, format, tests with coverage, expo-doctor), **When** the workflow runs, **Then** the build and release steps do not run, and no tag or release is created.
- **Given** the APK build, the signing verification or the upload fails, **When** the workflow ends, **Then** no release (and no tag pointing at a release without its APK) is left behind.
- **Given** a push to any other branch, or a pull request, **When** CI runs, **Then** the quality gates run as before (S0-28), and no APK is built and no release is created.
- **Given** the release job, **When** its permissions are read, **Then** only the release job gets write access to repository contents, and the quality-gate job keeps read-only permissions.

#### S05-04 — Every release installs over the previous one
**Module:** tooling
As the user, I want consecutive releases to be valid Android updates of each other, so that updating never forces an uninstall or loses my data.

- **Given** the APKs of two consecutive releases, **When** they are compared, **Then** they have the same package name, the same signing certificate (S05-02 fingerprint check) and strictly increasing `versionCode` (S05-01).
- **Given** build N is installed on a phone and has stored data, **When** build N+1 is installed over it, **Then** Android accepts it as an update, and the app starts with its database intact (checked on the device in S05-14).

### B. Self-update in the app (core-dev + ui-dev)

#### S05-05 — Update decision (domain)
**Module:** updates (domain)
As the user, I want the app to offer only a strictly newer build, so that I'm never asked to "update" to the same or an older version.

- **Given** an installed build number I and a latest release with build number R and one valid APK asset, **When** the decision runs, **Then** it returns "update available" (with R, the asset's download URL and size) if and only if R > I. Otherwise it returns "up to date". This is checked with a property-based test over random I and R.
- **Given** a release with no `.apk` asset, or more than one, **When** the release is read, **Then** the result is a failure with a specific error code (not "update available").
- **Given** a release whose build number is missing or not a positive whole number, or whose asset has no size or a non-`https` download URL, or whose download URL is not on a GitHub host, **When** it is read, **Then** the result is a failure with a specific error code.
- **Given** the decision and parsing logic, **When** coverage is measured, **Then** it is pure (no I/O, no Expo), immutable, returns `Result`, and has 100% domain coverage.

#### S05-06 — Check for an update at startup (application)
**Module:** updates (application)
As the user, I want the app to check GitHub for a newer build when it starts, without ever getting in the way of using it.

- **Given** the app is running from a release APK and the release source returns a newer build, **When** the check use case runs, **Then** it returns the update offer.
- **Given** the release source fails in any way: offline, timeout, HTTP error, rate limiting (HTTP 403/429), a malformed body, or a release failing S05-05, **When** the check runs, **Then** it resolves (never rejects or throws) with "no offer", and the failure is logged through the `Logger` port with its error code.
- **Given** the app is running in **Expo Go or a development build**, **When** the check runs, **Then** it returns "updater inactive" without calling the release source at all (no network request), and nothing is logged as an error.
- **Given** one app launch, **When** the app starts, **Then** the release source is called **at most once** for that launch, so normal use stays far below GitHub's 60 unauthenticated requests per hour.
- **Given** the use case, **When** it is tested, **Then** it uses in-memory fakes for its ports (release source, installed-app info, logger). Application coverage thresholds apply (100% lines, ≥ 95% branches).

#### S05-07 — GitHub latest-release adapter (infrastructure)
**Module:** updates (infrastructure)
As a developer, I want GitHub's API behind a port, so that the use case never knows about HTTP, and its failure modes are proven by tests.

- **Given** the adapter, **When** it requests the latest release of `difcortesgu/ExerciseTracker`, **Then** it uses GitHub's public REST API without authentication or embedded tokens, and the repository is configuration, not a string scattered through the code.
- **Given** HTTP responses for success, 404 (no releases yet), 403/429 (rate limited), 5xx, a network error, a body that isn't JSON, and a JSON body of the wrong shape, **When** the adapter handles each one, **Then** it returns the matching `ok`/`err` `Result` and never throws.
- **Given** a server that does not answer, **When** a timeout set by the architect passes, **Then** the request is abandoned and a timeout error is returned.
- **Given** the release-source port, **When** its contract suite runs, **Then** both the in-memory fake and the real adapter (with the HTTP boundary stubbed) pass the same suite (Liskov). Infrastructure coverage thresholds apply.

#### S05-08 — Startup update prompt (presentation)
**Module:** updates (presentation), core/app shell
As the user, I want to be asked before anything is downloaded, so that I decide when to update.

- **Given** the app starts, **When** the update check is still running or has failed, **Then** the tabs are shown and fully usable. Startup never waits for the check, and a failed check shows nothing.
- **Given** the check returns an offer for build N, **When** startup has finished, **Then** a dialog is shown with the text "Build N available" and two actions, **Update** and **Later**, findable by accessibility label in an RNTL test.
- **Given** the dialog, **When** the user taps **Later**, **Then** it closes, and it is not shown again during this launch, even when navigating between tabs or returning from the background.
- **Given** the user tapped **Later**, **When** the app is closed completely and started again, and the newer build still exists, **Then** the dialog is shown again (nothing is remembered between launches).
- **Given** the check returns "up to date" or "updater inactive", **When** startup finishes, **Then** no dialog is shown.
- **Given** a startup failure screen (S0-17), **When** it is shown, **Then** no update dialog is shown on top of it (see open question Q6).

#### S05-09 — Download the update with progress, error and retry
**Module:** updates (application, infrastructure, presentation)
As the user, I want to see the download progress and be able to retry if it fails, so that a bad connection never leaves the app stuck.

- **Given** the user tapped **Update**, **When** the download runs, **Then** progress is shown as a percentage (or bytes of total) that updates as data arrives, and is announced to screen readers through an accessibility label.
- **Given** a download in progress, **When** the user cancels it, **Then** the download stops, any partial file is deleted, and the app returns to normal use.
- **Given** the download fails (network lost, HTTP error, storage full), **When** the failure happens, **Then** an error message with **Retry** and **Close** actions is shown, the failure is logged, and the partial file is deleted.
- **Given** the downloaded file's size doesn't match the asset size from the release, **When** the download completes, **Then** it is treated as a failed download (error with retry), and the installer is not opened.
- **Given** the error message, **When** the user taps **Retry**, **Then** the download starts again from zero. **When** the user taps **Close**, **Then** the app stays usable on the screen it was on.
- **Given** an APK downloaded earlier (from a previous attempt or build), **When** a new download completes, **Then** the old file is replaced, not kept, so downloads don't pile up in storage.
- **Given** the download behind a port, **When** it is tested, **Then** the use case and view-model are tested with a fake downloader that emits progress, success, failure and cancellation. The real adapter is tested with the native module boundary mocked.

#### S05-10 — Hand the APK to Android's system installer
**Module:** updates (application, infrastructure, presentation)
As the user, I want the downloaded update opened in Android's own installer, so that I stay in control of what gets installed.

- **Given** a completed, size-checked download, **When** the hand-off runs, **Then** the app opens Android's **system package installer** for that file. The app never installs silently, and the user must confirm the install in Android's dialog.
- **Given** the app has not yet been allowed to install unknown apps, **When** the installer is opened the first time, **Then** Android asks the user to allow "Install unknown apps" for Exercise Tracker. Before handing off, the app shows a short note explaining this step.
- **Given** the user declines the permission or cancels the Android installer, **When** they return to the app, **Then** the app is usable on the same screen with no crash, and the update is offered again on the next launch.
- **Given** the user confirms the install, **When** Android finishes, **Then** the new build replaces the old one with the app's data kept (verified on the device in S05-14).
- **Given** the hand-off fails to open the installer (e.g. the file is missing), **When** it fails, **Then** an error with **Retry** (download again) is shown and logged, as in S05-09.
- **Given** the Android manifest of the release build, **When** it is inspected, **Then** it declares the install-packages permission needed for the hand-off, and ADR-003 explains why it is needed.

#### S05-11 — Show the installed build in Settings
**Module:** settings (presentation), updates
As the user, I want to see which build I'm running, so that I can confirm an update worked and report bugs against a build.

- **Given** the app runs from a release APK, **When** I open the Settings tab, **Then** it shows the app version and build number, e.g. "Version 0.1.0 (build 42)", findable by accessibility label.
- **Given** the app runs in Expo Go or a development build, **When** I open Settings, **Then** it shows that it is a development build instead of a build number.
- **Given** the Settings screen, **When** the build number is read, **Then** it comes through a port (not straight from an Expo API in the screen), the same one S05-06 uses.

### C. Documentation (architect)

#### S05-12 — README: installing, updating and release setup
**Module:** docs
- **Given** the README, **When** it is read, **Then** it explains how to install the first APK: open the latest GitHub Release on the phone, download the `.apk`, and allow the browser or file manager to "install unknown apps" once.
- **Given** the README, **When** it is read, **Then** it explains that in-app updates ask once for the "install unknown apps" permission for Exercise Tracker itself, and that every install is confirmed by the user in Android's dialog.
- **Given** the README, **When** it is read, **Then** it lists the four repository secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), how to produce the base64 value, and where the expected certificate fingerprint is configured (S05-02).
- **Given** the README, **When** it is read, **Then** it warns that **losing the keystore (or its passwords) means no further updates can install over the existing app**: the app must be uninstalled and the new build reinstalled, and local data is lost unless it was exported first (backup comes in Sprint 6).
- **Given** the README, **When** it is read, **Then** it states that the Expo Go workflow for development is unchanged and that the updater is inactive there, and that the release app and Expo Go are separate apps on the phone.
- **Given** the CI workflow file, **When** its header comment is read, **Then** it no longer says CD is deferred.

#### S05-13 — ADR-003: Release builds and self-update
**Module:** docs
- **Given** `docs/adr/003-release-and-self-update.md` (name chosen by the architect), **When** it is read, **Then** it records: why GitHub Actions + Gradle instead of EAS; how the native Android project is produced in CI (prebuild/CNG or committed); how signing is wired without committing secrets; the build-number scheme and how the app reads it; the release format (tag, title, asset, notes) the app relies on; the permissions added; how "Expo Go / dev build → updater inactive" is detected; and where the feature lives in the module structure.
- **Given** ADR-001 §1 says no dependency needs a development build, **When** ADR-003 adds native configuration or modules for the release build, **Then** it says whether each one still works in Expo Go, and ADR-001 is updated or cross-referenced.
- **Given** the patterns used (e.g. Adapter for GitHub/download/installer, Strategy or Null Object for the inactive updater), **When** the ADR is read, **Then** it names each one and the problem it solves here.

### D. Verification (qa-engineer)

#### S05-14 — On-device update verification
**Module:** tooling (manual checklist)
- **Given** a phone with build N installed from a GitHub Release and the app opened once (database created), **When** build N+1 is published and the app is started, **Then** the dialog appears, the download shows progress, Android's installer opens and asks for confirmation (and on the first time, for the "install unknown apps" permission), and after confirming, Settings shows build N+1 and the app starts without a startup error.
- **Given** the phone in airplane mode, **When** the app is started, **Then** no dialog, no crash, and the tabs are usable.
- **Given** the update dialog, **When** the user taps **Later**, **Then** it doesn't come back during that launch, and it comes back after a full restart.
- **Given** a download started on Wi-Fi, **When** the connection is cut halfway, **Then** an error with Retry appears, and Retry works once the connection is back.
- **Given** the project opened in Expo Go, **When** it starts, **Then** no update dialog appears, and the Sprint 0 manual checklist still passes.
- **Given** the results, **When** the QA report is written, **Then** it lists phone model, Android version, build numbers used and any step that failed.

##### Manual verification checklist (QA, Phase 3; the user runs it)

Neither the first real release run nor the on-device update can be checked in Jest or locally:
the repository is not pushed yet and the signing secrets don't exist yet. Tick each box and note
anything that differs. If a step fails, stop and write down the step number, what you saw and a
screenshot. Steps 0 to 2 also close the "real GitHub run" part of S05-01 to S05-04.

**0. One-time setup (on your computer)**
- [ ] 0.1 Create the release keystore **once** and back it up somewhere safe outside the repo
  (password manager or an encrypted drive). Losing it means no more updates (README, S05-12):
  `keytool -genkeypair -v -storetype PKCS12 -keystore exercise-tracker-release.keystore -alias release-key -keyalg RSA -keysize 4096 -validity 36500`
- [ ] 0.2 Read the certificate fingerprint (it is public):
  `keytool -list -v -keystore exercise-tracker-release.keystore -alias release-key`, and
  copy the `SHA256:` line (`AB:CD:…`).
- [ ] 0.3 Base64-encode the keystore on one line: `base64 -w0 exercise-tracker-release.keystore > keystore.b64`
  (macOS: `base64 -i exercise-tracker-release.keystore -o keystore.b64`).
- [ ] 0.4 GitHub → repository → Settings → Secrets and variables → Actions:
  secrets `ANDROID_KEYSTORE_BASE64` (contents of `keystore.b64`), `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS` (`release-key`), `ANDROID_KEY_PASSWORD`; **variable** (not a secret)
  `ANDROID_CERT_SHA256` = the fingerprint from 0.2. Then delete `keystore.b64`.
- [ ] 0.5 Never commit the keystore or `keystore.b64` (`git status` must not list them).

**1. First release run (S05-01 to S05-03)**
- [ ] 1.1 Push `main` to `difcortesgu/ExerciseTracker`. In the Actions tab the run shows three
  jobs in order: "Typecheck, lint, format, test" → "Plan release" → "Build, verify and publish
  the signed APK", all green.
- [ ] 1.2 "Plan release" log: "All release settings are present." and "Build number: N". Note N.
- [ ] 1.3 Release job log: "Signed with the expected certificate …" and "APK identity verified
  (versionCode N)." Search the whole log for your passwords and a few characters of the base64
  value: they never appear (only `***`). The run has **no** artifacts.
- [ ] 1.4 Releases page: "Build N", tag `build-N`, marked **Latest**, not draft, not pre-release,
  exactly **one** asset `exercise-tracker-build-N.apk`; the notes show the full commit SHA and the
  commit subject.
- [ ] 1.5 Re-run the whole successful run ("Re-run all jobs"): "Plan release" prints the notice
  "build-N is already published", the release job is skipped, and no second release appears.
- [ ] 1.6 Push a commit to another branch (and, if you like, open a pull request): only the
  quality job runs; no APK is built, no release or tag is created.
- [ ] 1.7 Missing-setting check: rename the variable `ANDROID_CERT_SHA256` temporarily (e.g. to
  `X_ANDROID_CERT_SHA256`), push a trivial commit to `main`: "Plan release" fails with
  "Missing release settings: ANDROID_CERT_SHA256 …", the release job doesn't run, no release or tag
  appears. Rename it back afterwards.
- [ ] 1.8 Optional local check of the downloaded APK (Android SDK build-tools):
  `apksigner verify --print-certs exercise-tracker-build-N.apk` shows one signer whose SHA-256
  equals your fingerprint; `aapt2 dump badging exercise-tracker-build-N.apk | head -1` shows
  `name='com.farid.exercisetracker' versionCode='N' versionName='0.1.0'`, and the output lists
  `uses-permission: name='android.permission.REQUEST_INSTALL_PACKAGES'`.

**2. First install on the phone (S05-02, S05-04, S05-11)**
- [ ] 2.1 On the phone, open `https://github.com/difcortesgu/ExerciseTracker/releases/latest`
  in the browser, download the `.apk`, open it, allow the browser (or file manager) to "install
  unknown apps" when Android asks, and install.
- [ ] 2.2 "Exercise Tracker" and Expo Go are both on the phone (two separate apps).
- [ ] 2.3 Open Exercise Tracker: loading, then the tabs; no "Startup failed"; **no** update
  dialog (it is already the latest build).
- [ ] 2.4 Settings tab shows "Version 0.1.0 (build N)".
- [ ] 2.5 Android Settings → Apps → Exercise Tracker → Storage: note "User data" / "App size".

**3. Later, cancel and decline (S05-08, S05-09, S05-10, S05-14 "Later")**
- [ ] 3.1 Push a trivial commit to `main` and wait for "Build N+1" on the Releases page.
- [ ] 3.2 Close the app completely (swipe it away in Recents) and open it: after the tabs appear,
  the dialog "Build N+1 available (xx MB)" with **Update** and **Later** is shown. The size is
  plausible (compare with the asset size on the release page).
- [ ] 3.3 Tap **Later**: the dialog closes. Switch between all tabs, press Home and reopen the app
  from Recents: the dialog does **not** come back.
- [ ] 3.4 Remount check (QA-05-1, fixed): on the Workout tab press Android's **Back** button
  until the app closes, then reopen it from the launcher (not from Recents). The dialog does
  **not** come back (on Android 11 and older this remounts the app in the same process; the
  dismissal is kept for the whole process).
- [ ] 3.5 Swipe the app away in Recents and open it again: the dialog is shown again.
- [ ] 3.6 Tap **Update**: a progress screen "Downloading build N+1" shows a percentage and
  "x MB of y MB" that go up. With TalkBack on (optional), the bar is read as "Download progress x%".
- [ ] 3.7 Tap **Cancel download**: back to the tabs on the same screen, no crash. Restart the app
  fully: the dialog is offered again.
- [ ] 3.8 Tap **Update**, let it finish: the note "Install the update" explains the "Install
  unknown apps" step. Tap **Not now**: back to the tabs, no crash.

**4. Network cut during the download (S05-09, S05-14)**
- [ ] 4.1 Turn mobile data **off**, Wi-Fi on. Restart the app fully, tap **Update**.
- [ ] 4.2 At roughly 30 to 60 %, turn Wi-Fi off. Within about a minute an error "Download failed –
  The update could not be downloaded. Check your connection and try again." with **Retry** and
  **Close** appears (note how long it took; a stall longer than 2 minutes is a bug).
- [ ] 4.3 Turn Wi-Fi back on and tap **Retry**: the progress starts again at 0 % and completes,
  then the install note appears.
- [ ] 4.4 (Variant) Repeat 4.1–4.2 and tap **Close** instead: the app stays on the tab it was on.

**5. Install the update (S05-10, S05-04, S05-14 main path)**
- [ ] 5.1 From the install note tap **Open installer**. The first time, Android says the app isn't
  allowed to install unknown apps: open its Settings, allow "Exercise Tracker", go back.
- [ ] 5.2 (Decline path, once) Before allowing, press back / deny instead: you return to the app,
  the tabs are usable, no crash. Restart fully: the update is offered again. Then repeat 3.6 →
  5.1 and allow.
- [ ] 5.3 (Cancel path, once) In Android's "Do you want to update this app?" dialog tap
  **Cancel**: back in the app, tabs usable, no crash. Restart fully: the update is offered again.
- [ ] 5.4 Confirm **Update** in Android's dialog, then **Open**. The app starts without "Startup
  failed", shows **no** update dialog, and Settings shows "Version 0.1.0 (build N+1)".
- [ ] 5.5 Android Settings → Apps → Exercise Tracker → Storage: "User data" is still there (not
  reset to the size of a fresh install; compare with 2.5), and the app was **not** uninstalled.
- [ ] 5.6 Optional: after two downloads, the app's cache is about one APK in size, not two
  (downloads don't pile up).

**6. Offline start (S05-06, S05-14 airplane mode)**
- [ ] 6.1 Publish "Build N+2" (trivial commit to `main`) so an update exists, turn on airplane
  mode, swipe the app away and open it: no dialog, no crash, all tabs usable, Settings shows
  build N+1.
- [ ] 6.2 Turn airplane mode off and restart the app fully: "Build N+2 available" is offered.

**7. Expo Go (S05-14, DoD item 6)**
- [ ] 7.1 `npm start`, open the project in Expo Go: no update dialog, and Settings shows
  "Version 0.1.0 (development build)".
- [ ] 7.2 The Sprint 0 manual checklist (`docs/sprints/sprint-0.md`) still passes. Optional:
  `npm run e2e` (the smoke flow now also checks for no update dialog and the development label).

**8. Report back**
- [ ] Phone model, Android version, build numbers used (N, N+1, N+2), the result of 3.4, the time
  measured in 4.2, and every step that failed (with screenshot).

---

## Work split

**Phase 1 — architect first (blocking).** Decide the module placement and boundary policy change, add dependencies, define the **ports and types** (release source, installed-app info, downloader, installer hand-off, update decision types and error codes) in an "Interfaces" section of this file, and draft S05-13. Then S05-01 to S05-04 (workflow, signing, build number, release). S05-12 at the end.

**Phase 2 — core-dev and ui-dev in parallel, on files that don't overlap** (exact folders set by the architect in Phase 1):

| Story | Owner |
|---|---|
| S05-05 Update decision | core-dev |
| S05-06 Check use case | core-dev |
| S05-07 GitHub adapter | core-dev |
| S05-09 Download (use case + adapter) | core-dev |
| S05-10 Installer hand-off (adapter) | core-dev |
| S05-08 Startup prompt | ui-dev |
| S05-09 Download progress / error / retry UI | ui-dev |
| S05-10 Permission note and return handling UI | ui-dev |
| S05-11 Build number in Settings | ui-dev |

**Phase 3 — qa-engineer.** Verify every AC, run `npx tsc --noEmit`, `npm run lint`, `npm test -- --coverage` and `npx expo-doctor`, check one real release run on GitHub, and run S05-14 on a device.

**Architect closes** with ADR-003 finalised and a design review of all stories.

---

## Interfaces (architect, Phase 1 — stable contract for Phase 2)

The contract files below **already exist** (types, ports and DI tokens only; tokens are tested in `src/shared/application/ports.test.ts` and `src/modules/updates/application/ports.test.ts`). Phase 2 adds implementations **next to** them, test-first. Changing a signature here is an architect decision: ask first, don't edit it silently. Design rationale: ADR-003.

### Folder layout per layer

| Path | Layer | Exists now | Phase 2 adds (owner) |
|---|---|---|---|
| `src/shared/domain/build-number.ts` | shared domain | `BuildNumber`, `InvalidBuildNumberError` | `MAX_ANDROID_VERSION_CODE`, `parseBuildNumber` (core-dev) |
| `src/shared/domain/installed-app.ts` | shared domain | `InstalledApp`, `ReleaseInstall`, `DevelopmentInstall` | — |
| `src/shared/application/installed-app-info.ts` | shared application | `InstalledAppInfo` port, `InstalledAppInfoToken` | — |
| `src/shared/infrastructure/app-info/expo-installed-app-info.ts` | shared infrastructure | — | `ExpoInstalledAppInfo` adapter (core-dev) |
| `src/modules/updates/domain/release.ts` | updates domain | `PublishedRelease`, `PublishedReleaseAsset`, `Release`, `ApkAsset`, `HttpsUrl`, `ReleaseErrorCode`, `ReleaseError` | `parseRelease`, `RELEASE_TAG_PREFIX`, `TRUSTED_DOWNLOAD_HOSTS` (core-dev) |
| `src/modules/updates/domain/update-decision.ts` | updates domain | `UpdateDecision` | `decideUpdate` (core-dev) |
| `src/modules/updates/application/release-source.ts` | updates application | `ReleaseSource` port + token, `ReleaseSourceError(Code)` | — |
| `src/modules/updates/application/apk-downloader.ts` | updates application | `ApkDownloader` port + token, `DownloadRequest`, `DownloadTask`, `DownloadProgress`, `DownloadedApk`, `DownloadError(Code)` | — |
| `src/modules/updates/application/apk-installer.ts` | updates application | `ApkInstaller` port + token, `InstallerError(Code)` | — |
| `src/modules/updates/application/check-for-update.ts` | updates application | `CheckForUpdate` use-case type + token, `UpdateCheckOutcome`, `UpdateCheckError` | `createCheckForUpdate` (core-dev) |
| `src/modules/updates/application/download-update.ts` | updates application | `DownloadUpdate` type + token | `createDownloadUpdate` (core-dev) |
| `src/modules/updates/application/install-update.ts` | updates application | `InstallUpdate` type + token | `createInstallUpdate` (core-dev) |
| `src/modules/updates/application/update-offer-dismissal.ts` | updates application | added after QA-05-1 (ui-dev, architect-approved at close-out) | `UpdateOfferDismissal` port, `UpdateOfferDismissalToken`, `createUpdateOfferDismissal` (in-memory, per container) |
| `src/core/presentation/app-shell.tsx` | core presentation | added at close-out (architect, QA-05-3) | `AppShell`: DI provider + status bar + startup gate; `overlay` rendered only after a successful startup |
| `src/modules/updates/infrastructure/` | updates infrastructure | empty | `github-release-config.ts`, `github-release-source.ts`, `expo-apk-downloader.ts`, `intent-apk-installer.ts` (core-dev) |
| `src/modules/updates/presentation/` | updates presentation | empty | dialog, progress, error and install-note components, `useUpdateFlow` view model + its state machine (ui-dev) |
| `src/modules/updates/index.ts` | public API | domain types, ports, use-case types and tokens | presentation exports only (ui-dev) |

### Ports and types (exact signatures, as in the files)

```ts
// src/shared/domain/build-number.ts
export type BuildNumber = Brand<number, 'BuildNumber'>;          // 1 .. 2_100_000_000
export type InvalidBuildNumberError = DomainError<'shared.invalidBuildNumber'>;
// Phase 2: export const MAX_ANDROID_VERSION_CODE = 2_100_000_000;
// Phase 2: export function parseBuildNumber(raw: number): Result<BuildNumber, InvalidBuildNumberError>;

// src/shared/domain/installed-app.ts
export type InstalledApp = ReleaseInstall | DevelopmentInstall;
export interface ReleaseInstall { readonly kind: 'release'; readonly version: string; readonly buildNumber: BuildNumber }
export interface DevelopmentInstall { readonly kind: 'development'; readonly version: string }

// src/shared/application/installed-app-info.ts
export interface InstalledAppInfo { getInstalledApp(): InstalledApp }     // sync, constant per process
export const InstalledAppInfoToken: Token<InstalledAppInfo>;              // 'shared.InstalledAppInfo'

// src/modules/updates/domain/release.ts
export type HttpsUrl = Brand<string, 'HttpsUrl'>;
export interface PublishedRelease { readonly tagName: string; readonly assets: readonly PublishedReleaseAsset[] }
export interface PublishedReleaseAsset { readonly name: string; readonly downloadUrl: string; readonly sizeBytes: number | null }
export interface Release { readonly buildNumber: BuildNumber; readonly apk: ApkAsset }
export interface ApkAsset { readonly name: string; readonly downloadUrl: HttpsUrl; readonly sizeBytes: number }
export type ReleaseError = DomainError<ReleaseErrorCode>;
// Phase 2: export function parseRelease(published: PublishedRelease): Result<Release, ReleaseError>;

// src/modules/updates/domain/update-decision.ts
export type UpdateDecision =
  | { readonly kind: 'updateAvailable'; readonly release: Release }
  | { readonly kind: 'upToDate' };
// Phase 2: export function decideUpdate(installed: BuildNumber, latest: Release): UpdateDecision;

// src/modules/updates/application/release-source.ts
export interface ReleaseSource { fetchLatestRelease(): Promise<Result<PublishedRelease, ReleaseSourceError>> }
export const ReleaseSourceToken: Token<ReleaseSource>;                    // 'updates.ReleaseSource'

// src/modules/updates/application/apk-downloader.ts
export interface DownloadProgress { readonly receivedBytes: number; readonly totalBytes: number }
export interface DownloadedApk { readonly fileUri: string; readonly sizeBytes: number }
export interface DownloadRequest {
  readonly url: HttpsUrl;
  readonly expectedSizeBytes: number;
  readonly onProgress: (progress: DownloadProgress) => void;
}
export interface DownloadTask { readonly result: Promise<Result<DownloadedApk, DownloadError>>; cancel(): void }
export interface ApkDownloader { start(request: DownloadRequest): DownloadTask }
export const ApkDownloaderToken: Token<ApkDownloader>;                    // 'updates.ApkDownloader'

// src/modules/updates/application/apk-installer.ts
export interface ApkInstaller { openInstaller(apk: DownloadedApk): Promise<Result<void, InstallerError>> }
export const ApkInstallerToken: Token<ApkInstaller>;                      // 'updates.ApkInstaller'

// src/modules/updates/application/check-for-update.ts
export type UpdateCheckError = ReleaseSourceError | ReleaseError;
export type UpdateCheckOutcome =
  | { readonly kind: 'inactive' }
  | { readonly kind: 'upToDate'; readonly installed: BuildNumber }
  | { readonly kind: 'checkFailed'; readonly error: UpdateCheckError }
  | { readonly kind: 'updateAvailable'; readonly release: Release };
export type CheckForUpdate = () => Promise<UpdateCheckOutcome>;           // never rejects; memoized per launch
export const CheckForUpdateToken: Token<CheckForUpdate>;                  // 'updates.CheckForUpdate'
// Phase 2: export function createCheckForUpdate(deps: {
//   installedAppInfo: InstalledAppInfo; releaseSource: ReleaseSource; logger: Logger }): CheckForUpdate;

// src/modules/updates/application/download-update.ts
export type DownloadUpdate = (release: Release, onProgress: (progress: DownloadProgress) => void) => DownloadTask;
export const DownloadUpdateToken: Token<DownloadUpdate>;                  // 'updates.DownloadUpdate'
// Phase 2: export function createDownloadUpdate(deps: { downloader: ApkDownloader; logger: Logger }): DownloadUpdate;

// src/modules/updates/application/install-update.ts
export type InstallUpdate = (apk: DownloadedApk) => Promise<Result<void, InstallerError>>;
export const InstallUpdateToken: Token<InstallUpdate>;                    // 'updates.InstallUpdate'
// Phase 2: export function createInstallUpdate(deps: { installer: ApkInstaller; logger: Logger }): InstallUpdate;

// src/modules/updates/application/update-offer-dismissal.ts (added after QA-05-1)
export interface UpdateOfferDismissal {
  isDismissed(): boolean;                                                 // true once dismissed in this process
  dismiss(): void;                                                        // idempotent; never persisted
}
export const UpdateOfferDismissalToken: Token<UpdateOfferDismissal>;      // 'updates.UpdateOfferDismissal'
export function createUpdateOfferDismissal(): UpdateOfferDismissal;       // in-memory; one instance = one launch

// src/core/presentation/app-shell.tsx (added at close-out, QA-05-3)
export interface AppShellProps { readonly resolver: Resolver; readonly children: ReactNode; readonly overlay?: ReactNode }
export function AppShell(props: AppShellProps): ReactElement;            // overlay only after a successful startup
```

### Error codes

| Code | Raised by | What the UI does |
|---|---|---|
| `shared.invalidBuildNumber` | `parseBuildNumber` | (internal; mapped to `updates.invalidBuildNumber` by `parseRelease`) |
| `updates.invalidBuildNumber` | `parseRelease`: tag is not `build-<n>`, n = 1..2 100 000 000, no leading zeros | nothing (logged `checkFailed`) |
| `updates.missingApkAsset` / `updates.multipleApkAssets` | `parseRelease`: zero / more than one asset ending in `.apk` (any case) | nothing (logged) |
| `updates.invalidAssetSize` | `parseRelease`: size `null`, not a whole number, or ≤ 0 | nothing (logged) |
| `updates.insecureDownloadUrl` | `parseRelease`: not an absolute `https://` URL | nothing (logged) |
| `updates.untrustedDownloadHost` | `parseRelease`: https, but host ≠ `github.com` (exact match, case-insensitive) | nothing (logged) |
| `updates.noPublishedRelease` | adapter: HTTP 404 | nothing (logged) |
| `updates.rateLimited` | adapter: HTTP 403 or 429 | nothing (logged) |
| `updates.httpError` | adapter: any other non-2xx (`details.status`) | nothing (logged) |
| `updates.networkUnavailable` | adapter: fetch rejected (offline, DNS, TLS) | nothing (logged) |
| `updates.timeout` | adapter: no answer within `RELEASE_CHECK_TIMEOUT_MS` = 10 000 | nothing (logged) |
| `updates.malformedResponse` | adapter: body not JSON or wrong shape | nothing (logged) |
| `updates.downloadFailed` | downloader: network, HTTP, storage (`details.cause`) | error with **Retry** / **Close** (logged) |
| `updates.downloadSizeMismatch` | downloader: completed size ≠ `expectedSizeBytes` (file deleted) | error with **Retry** / **Close** (logged) |
| `updates.downloadCancelled` | downloader: after `cancel()` | back to normal use, **no** error, not logged as an error |
| `updates.apkMissing` | installer: file gone | error with **Retry** (= download again) (logged) |
| `updates.installerUnavailable` | installer: intent failed (`details.cause`) | error with **Retry** (logged) |

### Behaviour the implementations must honour (beyond the TSDoc in the files)

- **Domain (S05-05):** pure, immutable, `Result`-returning; regex parsing, no `URL` global. `decideUpdate` is `updateAvailable` **iff** `latest.buildNumber > installed` (fast-check property). 100% coverage; Stryker ≥ 80%.
- **`createCheckForUpdate` (S05-06):** `development` → `inactive` without calling the source, nothing logged as error. Source `err` or `parseRelease` `err` → `logger.warn(…, { code })` + `checkFailed`. An unexpected rejection of the source is caught and becomes a logged `checkFailed` with `updates.networkUnavailable` (never rejects). The **first call's promise is cached**: later calls return it (at most one request per launch).
- **`createDownloadUpdate` (S05-09):** passes `release.apk.downloadUrl` and `release.apk.sizeBytes` to the downloader; logs every `err` except `updates.downloadCancelled`; each call is a new download (Retry = call again).
- **`createInstallUpdate` (S05-10):** delegates to the installer; logs `err`.
- **`GitHubReleaseSource` (S05-07):** `GET https://api.github.com/repos/{owner}/{repo}/releases/latest`, headers `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, no auth. Constructor takes `{ repository: { owner, name }, timeoutMs, fetch }` (the composition root passes the global `fetch`; tests pass a stub). Maps `tag_name`, `assets[].name`, `assets[].browser_download_url`, `assets[].size` (missing size → `null`). Timeout through `AbortController`. `github-release-config.ts` holds `GITHUB_RELEASE_REPOSITORY = { owner: 'difcortesgu', name: 'ExerciseTracker' }` and `RELEASE_CHECK_TIMEOUT_MS = 10_000`.
- **`ExpoApkDownloader` (S05-09):** `expo-file-system` `File.createDownloadTask(url, file, { onProgress, signal })` (or `downloadFileAsync` with `idempotent: true`) to one fixed file `Paths.cache/updates/update.apk`; delete it before starting and on failure/cancel/size mismatch; `cancel()` aborts through `AbortController`. `totalBytes` reported to the UI is `expectedSizeBytes` (the server's may be -1).
- **`IntentApkInstaller` (S05-10):** `expo-intent-launcher` `startActivityAsync('android.intent.action.VIEW', { data: file.contentUri, type: 'application/vnd.android.package-archive', flags: 1 /* FLAG_GRANT_READ_URI_PERMISSION */ })`; missing file → `updates.apkMissing`; rejection → `updates.installerUnavailable`.
- **`ExpoInstalledAppInfo` (S05-06/11):** `development` if `Constants.executionEnvironment === ExecutionEnvironment.StoreClient` or `__DEV__`; else `release` with `parseBuildNumber(Number(Application.nativeBuildVersion))` and `version = Application.nativeApplicationVersion`; a release without a parsable build number → `development` + `logger.warn`. Development `version` comes from `Constants.expoConfig?.version`. Read values are injected into the class (a small factory reads the native modules), so tests mock only the native boundary.
- **Contract suites (Liskov):** `test/contracts/release-source.contract.ts`, `apk-downloader.contract.ts`, `installed-app-info.contract.ts`, each run against the fake and the real adapter.
- **Composition root (`src/core/di/composition-root.ts`):** registers `InstalledAppInfoToken`, `ReleaseSourceToken`, `ApkDownloaderToken`, `ApkInstallerToken`, `CheckForUpdateToken`, `DownloadUpdateToken`, `InstallUpdateToken`, `UpdateOfferDismissalToken` (lazy singletons; the memoized `CheckForUpdate` and the `UpdateOfferDismissal` store must be singletons, i.e. one per container = one per JS process).
- **Presentation (S05-08 to S05-11):**
  - `app/_layout.tsx` renders the update prompt **inside** `<AppBootstrapGate>` next to `<Slot />`. The gate shows children only after a successful startup, so there is never a prompt over the failure screen (Q6). Startup never waits for the check. *Close-out:* the composition moved into the tested `AppShell` (`src/core/presentation/app-shell.tsx`); `app/_layout.tsx` passes `<Slot />` as children and `<UpdatePrompt />` as `overlay` (QA-05-3).
  - *QA-05-1:* every transition to `dismissed` is recorded in the `UpdateOfferDismissal` store, and `useUpdateFlow` starts a (re)mounted prompt from it (`initialUpdateFlowState`), so "Later" holds for the whole process, not only for one mount.
  - The view model is an explicit state machine (discriminated union + reducer, named as such), e.g. `idle → offered → downloading(progress) → downloadFailed | readyToInstall → installNote → installing → dismissed`. "Later" → `dismissed` for the rest of the launch. The prompt is mounted once in the root layout; if state must survive a remount, it is registered in the container, never a module-level mutable singleton.
  - Before the hand-off, show the short "install unknown apps" note every time (Android has no Expo API to ask whether it was already granted).
  - Settings resolves `InstalledAppInfoToken` through `useDependency` (read-only port, ADR-003 §6) and shows "Version 0.1.0 (build 42)" or a development label.
  - Q4: the size is available as `release.apk.sizeBytes` if the dialog shows it.

### Phase 2 ownership (non-overlapping)

| Owner | Files (create or change) |
|---|---|
| **core-dev** | `src/shared/domain/build-number.ts` (+ test); `src/modules/updates/domain/**`; `src/modules/updates/application/**`; `src/modules/updates/infrastructure/**`; `src/shared/infrastructure/app-info/**`; `src/core/di/composition-root.ts` (+ test); new files in `test/fakes/`, `test/builders/`, `test/contracts/` for these ports |
| **ui-dev** | `src/modules/updates/presentation/**`; `src/modules/updates/index.ts` (add presentation exports only); `src/modules/settings/presentation/**`; `src/modules/settings/index.ts` (only if a new export is needed); `app/_layout.tsx` |
| **architect** | contract files listed above (signature changes on request), `tooling/**`, `.github/workflows/ci.yml`, `app.json`, `app.config.js`, ADR-003, README (S05-12) |

**Order inside Phase 2.** core-dev's **first** deliverable unblocks ui-dev and should be small: `parseBuildNumber`, `parseRelease`, and the builders `aPublishedRelease()`, `aRelease()`, `aReleaseInstall()`, `aDevelopmentInstall()` in `test/builders/` (branded values can only be created through the parse functions; no casts). Until then, ui-dev builds the presentational components with plain view props (strings and numbers: title, percentage, error text, labels), which need no domain values. View-model tests stub the use cases with plain functions typed as `CheckForUpdate` / `DownloadUpdate` / `InstallUpdate` (they are functions, no fakes needed) and use the shared builders for values.

---

## Out of scope for Sprint 0.5

- Silent or background installs (Android doesn't allow them for sideloaded apps without user confirmation, and the user chose "ask first").
- Over-the-air JavaScript updates (EAS Update) and Play Store distribution.
- Checking for updates on resume or on a schedule, and a manual "Check for updates" button (see open question Q3).
- Remembering "Later" across launches, skipping a specific build, or forcing mandatory updates.
- Downgrades / rollback from inside the app (older APKs remain downloadable from GitHub Releases, but Android won't install a lower `versionCode` over a higher one).
- Any Sprint 1 feature work.

---

## Definition of Done (every story, from `docs/ENGINEERING_STANDARDS.md` §6)

1. Meets all acceptance criteria in this file.
2. Respects the layer and module boundaries; `npm run lint` (including boundary rules) passes.
3. Developed with TDD (§4.1); `npx tsc --noEmit` and `npm test -- --coverage` pass with all per-layer coverage thresholds met.
4. No duplicated business logic; new extension points documented.
5. Architect design review done; significant decisions recorded as ADRs in `docs/adr/`.
6. Runs in Expo Go on Android.

For this sprint, item 6 means: the app still runs in Expo Go with the updater inactive, **and** the release APK from CI installs and starts on Android.

In addition, each agent report includes TDD evidence: the tests written first, confirmed to have been seen failing before the implementation (§4.1).

---

## Decisions (made by the user, 2026-11-13)

1. **Build in GitHub Actions with Gradle**, no EAS and no Expo account. On every push to `main`, once the quality gates pass, CI builds a signed release APK and publishes it as a GitHub Release on the public repo `difcortesgu/ExerciseTracker`. A failing quality gate means no release.
2. **One fixed signing key**, stored as 4 repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Every APK is signed with it. The keystore and passwords are never committed.
3. **Ask first, then install.** At startup, if a newer release exists, the app shows "Build N available – Update / Later". Update downloads with visible progress, then opens Android's system installer. Android always asks the user to confirm, and the first time asks to allow "install unknown apps" for the app.
4. **Monotonic build number** = Android `versionCode`. The app only offers a strictly newer build.

## User actions needed

- Add the 4 secrets to the GitHub repository (Settings → Secrets and variables → Actions).
- Provide the signing certificate's SHA-256 fingerprint (public; e.g. from `keytool -list -v -keystore <file>`), so CI can verify every APK was signed with the right key (S05-02).
- Push the repository to `difcortesgu/ExerciseTracker` (needed for any CI run, see Sprint 0 bug Q-4).
- Configure the expected certificate fingerprint as a **repository variable** (not a secret, it is public) named `ANDROID_CERT_SHA256` (Settings → Secrets and variables → Actions → Variables). Both `keytool` notation (`AB:CD:…`) and plain hex are accepted. Until it and the 4 secrets exist, every push to `main` fails in the "Plan release" job with a message naming what is missing (by design, nothing is published).
- Optional: repository variable `BUILD_NUMBER_OFFSET` (whole number, default 0). Only needed if the workflow's run counter ever restarts (ADR-003 §4).

## Open questions

**Answers assumed by the architect on 2026-11-14 (pending user confirmation; the user may override):**
- **Q1:** keep S05-11 (build number in Settings).
- **Q2:** keep `0.1.0`; only the build number increases. CI enforces it (`verify-apk` checks that `versionName` equals `expo.version`).
- **Q3:** check only at app start.
- **Q4:** undecided. The domain `Release` carries the APK size (`apk.sizeBytes`, needed for the size check anyway), so the dialog *can* show it cheaply; showing it is optional for ui-dev.
- **Q5:** keep all releases.
- **Q6:** no update offer on the startup failure screen (guaranteed by construction, see A1).

**Architect answers (Phase 1, 2026-11-14; details in ADR-003):**
- **A1 — Module placement:** a new feature module **`src/modules/updates/`** (domain, application, infrastructure, presentation, `index.ts`). **No boundary-policy change is needed**: the boundary element descriptors are generic over `src/modules/*`, so `updates` gets every layer and module rule automatically. "Which build is running" is shared by `updates` and `settings`, so `BuildNumber` and `InstalledApp` go to `src/shared/domain`, the `InstalledAppInfo` port to `src/shared/application`, and its Expo adapter to `src/shared/infrastructure/app-info/` (settings does not depend on updates). The dialog is rendered by `app/_layout.tsx` inside `AppBootstrapGate`'s children, which render only after a successful startup, so `src/core/presentation` doesn't depend on a feature module and Q6 holds by construction. Lint was tightened (rule tests first): presentation may not import `expo-application`, `expo-constants`, `expo-intent-launcher` (nor `expo-file-system`, already listed); domain, application and presentation may not use the `fetch`, `XMLHttpRequest` or `WebSocket` globals.
- **A2 — Build number:** `github.run_number` of the CI workflow + optional repository variable `BUILD_NUMBER_OFFSET` (default 0). New runs always get a higher `run_number`; re-runs keep it; cancelled or failed runs just leave a gap. Runs on `main` queue instead of cancelling each other (`cancel-in-progress` only off `main`), so releases are published one at a time in push order. Before building, the plan step lists the remote tags and publishes only if the number is greater than every `build-<n>` tag (already published → notice and skip; older than a published build → warning and skip), which covers re-runs and a restarted counter. Release = draft with APK, then published as latest; a failed or cancelled run deletes its draft, so no tag ever exists without its APK. Format: tag `build-<n>`, title `Build <n>`, asset `exercise-tracker-build-<n>.apk`. `APP_BUILD_NUMBER` → `app.config.js` → `android.versionCode`. At runtime the app reads `nativeBuildVersion` (= `versionCode`) from `expo-application` through the `InstalledAppInfo` port, so the number shown is by construction the APK's `versionCode`.
- **A3 — Native project:** Continuous Native Generation in CI: `npx expo prebuild --platform android --clean --no-install`, `android/` stays git-ignored, then `./gradlew assembleRelease` with the AGP injected-signing properties (no edits to the generated Gradle files). Nothing breaks Expo Go: `app.config.js` returns `app.json` unchanged when `APP_BUILD_NUMBER` is not set (tested), `REQUEST_INSTALL_PACKAGES` in `app.json` is ignored by Expo Go and applied only by prebuild, and the three added packages (`expo-application`, `expo-file-system`, `expo-intent-launcher`) are part of Expo Go (no development build needed). `npx expo-doctor`: 20/20 passed with the new config. Prebuild and a signed `assembleRelease` were verified locally in a scratch copy with a throwaway keystore: versionCode, versionName, package and permission are correct, the APK is signed with the given key (not the debug key), and the CI verification scripts pass on it (ADR-003 §2).

For the user (original questions):
- **Q1 — Build number in Settings (S05-11):** this story is proposed by the PO so the update can be verified on the phone. Keep it, or drop it?
- **Q2 — User-visible version:** keep `0.1.0` and only increase the build number per build (proposed), or bump the version name as well?
- **Q3 — When to check:** only at app start (as requested, proposed), or also when the app returns from the background or from a "Check for updates" button in Settings (later sprint)?
- **Q4 — Download size in the dialog:** should the dialog also show the APK size (useful on mobile data), e.g. "Build 42 available (35 MB)"?
- **Q5 — Old releases:** keep every release on GitHub (proposed; allows manually reinstalling an older build after uninstalling), or delete older ones automatically?
- **Q6 — Startup failure:** if startup fails (e.g. a migration error), should the app still offer an update, since a newer build may contain the fix? Proposed for this sprint: no, keep the failure screen simple; revisit when the first real migration ships in Sprint 1.

For the architect (Phase 1):
- **A1 —** Where the self-update feature lives (new `updates` module vs `src/core` vs `settings`), and the matching boundary-policy change.
- **A2 —** How the build number is produced (e.g. the workflow run number) and read at runtime, so S05-01's "strictly increasing, never reused" holds even across re-runs and cancelled runs.
- **A3 —** How the native Android project is produced in CI, and whether anything added for the release build affects Expo Go or `expo-doctor`.

---

## QA report (Phase 3, qa-engineer, 2026-11-14)

Scope: every AC of S05-01 to S05-13 checked against code and tests; CI workflow reviewed by
reading (actionlint is not available); all gates run locally on the uncommitted working tree.
S05-14 and the first real GitHub release run are **not done**: they need the pushed repository,
the signing secrets and a phone (checklist above, under S05-14).

### Gate results (real output, after the QA changes)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no errors |
| `npm run lint` (incl. boundary rules, `--max-warnings=0`) | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm test -- --coverage` | 93 suites, 992 tests passed (before QA: 92 / 970); all files 100 % statements (755/755), branches (379/379), functions (260/260), lines (708/708); every per-layer threshold met, including `src/modules/updates/{domain,application,infrastructure,presentation}`, `src/shared/infrastructure/app-info` and `tooling/release` (100 %) |
| `npx expo-doctor` | "20/20 checks passed. No issues detected!" |
| `npx expo export --platform android` (into a temp folder outside the repo, deleted afterwards) | exit 0: one Hermes bundle (3 MB), 26 assets; no unresolved import in the app, updates or settings code |
| Stryker on the Sprint 0.5 domain (`build-number.ts`, `release.ts`, `update-decision.ts`) | before QA 86.27 % (41 killed, 3 timeout, 7 survived); after QA 98.0 % (`release.ts` 97.30 %, the other two 100 %). The one remaining survivor, `release.ts:90` `digits === undefined` → `false`, is **equivalent** (`Number(undefined)` is `NaN`, which `parseBuildNumber` rejects with the same error). The "errors" column counts mutants rejected by the TypeScript checker. |
| Forbidden constructs in the new code (`any`, `@ts-ignore`, `eslint-disable`, `.skip`, `.only`, `xit`, `!` in domain/application, TODO without backlog item) | none found |
| Contract suites (Liskov) | ReleaseSource, ApkDownloader, ApkInstaller and InstalledAppInfo suites each run against the fake **and** the real adapter |

### Per-story verdict

| Story | Verdict | Notes |
|---|---|---|
| S05-01 Build number | **Pass (code + tests); needs real CI run** | `release-plan.js` (run_number + offset, refuses ≤ latest tag), `app-config.js` (versionCode only when `APP_BUILD_NUMBER` is set, `expo.version` untouched), app reads `nativeBuildVersion` through `InstalledAppInfo`. Machine-readable tag `build-<n>` documented in ADR-003 §5; the two implementations are now pinned against each other (test added). |
| S05-02 Signed APK | **Pass (code + tests); needs real CI run** | Gradle `assembleRelease` with AGP injected signing, no EAS; `check-release-settings` names every missing secret/variable before building; `verify-certificate` (exactly one signer, SHA-256 = `ANDROID_CERT_SHA256`); `verify-apk` checks package, versionCode, versionName, permission. Keystore only in `$RUNNER_TEMP`, `umask 077`, deleted with `if: always()`, no artifact upload; secrets passed through `env`, never inlined in scripts. |
| S05-03 Publish release | **Pass (code review); needs real CI run** | `release-plan` needs `quality`, `release` needs `release-plan` (implicit `success()`), main-push only; draft → publish `--latest`; cleanup `if: failure() \|\| cancelled()` deletes an unfinished draft; only `release` has `contents: write`. Notes: SHA, subject, run link. |
| S05-04 Install over | **Pass (CI checks); needs device (S05-14 step 5)** | Same package + certificate check + strictly increasing versionCode. |
| S05-05 Update decision | **Pass** | Pure, frozen, `Result`; property test for "offer iff R > I"; every error code tested; 100 % coverage; Stryker 98 %. |
| S05-06 Check use case | **Pass** | Fakes only; every failure → logged `checkFailed` with code; rejection caught; `inactive` without request in development; memoized first promise (singleton in the composition root, tested). |
| S05-07 GitHub adapter | **Pass** | Unauthenticated, repository in config, 404/403/429/5xx/network/non-JSON/wrong shape, 10 s `AbortController` timeout (incl. slow body), contract suite on fake + adapter. |
| S05-08 Startup prompt | **Pass with bug QA-05-1 (Low)** | Never blocks startup, nothing on failure/up to date/inactive, labels queryable, Later not shown again across tab changes. Not kept across a **remount** in the same process (QA-05-1). Q6 holds by construction (prompt inside `AppBootstrapGate` in `app/_layout.tsx`); the layout itself has no automated test (QA-05-3). |
| S05-09 Download | **Pass** | Progress % + MB with accessibility label, cancel deletes partial file, failure/size mismatch → Retry/Close and logged (cancel not logged), Retry from zero, one fixed file replaced. Native boundary mocked through `test/support/in-memory-expo-file-system.ts`. |
| S05-10 Installer hand-off | **Pass (code + tests); needs device** | `ACTION_VIEW` + content URI + `FLAG_GRANT_READ_URI_PERMISSION` (cache dir is covered by expo-file-system's FileProvider paths), note shown every time, return → dismissed, `apkMissing`/`installerUnavailable` → Retry; permission in `app.json` and verified in the APK by CI; ADR-003 §8 explains it. |
| S05-11 Build in Settings | **Pass** | "Version 0.1.0 (build 42)" / "(development build)", label "App version", read through `InstalledAppInfoToken` (same port as S05-06). |
| S05-12 README | **Fail (open, architect)** | README "Release APK and in-app updates" is still the Phase 1 stub: first install steps, the in-app "install unknown apps" note, how to produce the base64 value, the keystore-loss warning and "release app and Expo Go are separate apps" are missing (QA-05-2). The workflow header no longer says CD is deferred (that AC passes). |
| S05-13 ADR-003 | **Pass (status still "Proposed")** | Covers EAS vs Gradle, CNG, signing, build number, release format, permissions, Expo Go detection, module placement, Expo Go impact per package, ADR-001 amended, patterns named. To be marked Accepted after the first real run. |
| S05-14 On-device | **Not run (needs user)** | Checklist written above. |

### Bugs and findings

| ID | Severity | Owner | Finding |
|---|---|---|---|
| QA-05-1 | Low | ui-dev (architect sign-off) | **Fixed, architect-approved at close-out:** a process-scoped `UpdateOfferDismissal` store (`src/modules/updates/application/update-offer-dismissal.ts`, singleton per container in `composition-root.ts`, not persisted) records every transition to `dismissed`, and `useUpdateFlow` starts a remounted prompt from it (`initialUpdateFlowState`); covered by `update-prompt-remount.test.tsx`. Architect: add the new store to the Interfaces section and correct ADR-003 §11. Original finding: **"Later" is forgotten when the prompt remounts in the same process.** The flow state lives in `useReducer` (`src/modules/updates/presentation/use-update-flow.ts:46`), while the check result is memoized for the whole process (`src/modules/updates/application/check-for-update.ts:92`). Any remount of `UpdatePrompt` therefore starts in `idle`, gets the cached `updateAvailable` again (`use-update-flow.ts:50`) and re-offers. Real trigger: on Android 11 and older, Back on the root tab finishes the activity but keeps the JS runtime, so reopening the app remounts the root layout and the dialog returns although S05-08 says "not shown again during this launch … returning from the background". Steps to reproduce in Jest (confirmed by a throwaway QA probe, not committed): container with the real `createCheckForUpdate` (fake source answering build 42, installed 41) → render `<UpdatePrompt />` → tap Later → `unmount()` → render again with the same container → the Later button is shown again. The Interfaces section already prescribes the fix ("if state must survive a remount, it is registered in the container"). ADR-003 §11 also says the memoizing proxy covers remounts, which is only true for the request, not for the dismissal. |
| QA-05-2 | Medium (blocks DoD of S05-12) | architect | **Fixed at close-out** (README "Release APK and in-app updates"). README S05-12 content missing (see verdict table). `README.md:37-45`. |
| QA-05-3 | Low (test gap) | architect | **Fixed at close-out** (`AppShell` + `app-shell.test.tsx`, ADR-003 §6). `app/_layout.tsx` (prompt inside `AppBootstrapGate`, Q6 by construction) has no automated test: test files can't live in `app/` (expo-router would bundle them as routes) and the boundary policy doesn't allow test files elsewhere to import `app`. A regression that moves `<UpdatePrompt />` outside the gate would not be caught. Option: extract the shell into a testable component under `src/core` or allow test files to import the `app` element. |
| QA-05-4 | Low (hardening) | architect | **Fixed at close-out** (`GH_TOKEN` per `gh` step, `persist-credentials: false` on the quality and release checkouts, ADR-003 §3). The release job exports `GH_TOKEN` (contents: write) at **job** level (`.github/workflows/ci.yml:121`), so it is visible to `npm ci` lifecycle scripts, `expo prebuild` and Gradle plugins; `actions/checkout` also persists the write token in `.git/config`. Narrow `GH_TOKEN` to the two `gh` steps and set `persist-credentials: false` on the release job's checkout. Not required by an AC. |
| QA-05-5 | Info | architect | **Done** (README "Good to know"). `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` (`ci.yml`, Gradle step): the APK won't install on x86/x86_64 emulators. Fine for the phone; worth one line in the README. |

No bug found in: domain parsing (URL/host spoofing cases incl. `github.com.evil`, user-info, ports), build-number limits, adapter failure mapping, download cleanup, composition root (every token used by `app/_layout.tsx` and Settings resolves: Bootstrapper, CheckForUpdate, DownloadUpdate, InstallUpdate, InstalledAppInfo; updater inactive in Jest/dev, tested), release CLI, workflow job graph and secret handling. All referenced action versions exist (`actions/checkout@v5`, `actions/setup-node@v5`, `actions/setup-java@v6`, `gradle/actions/setup-gradle@v6`, checked with `git ls-remote`).

### CI workflow review (by reading)

- **Triggers / job graph:** `quality` on every push and PR; `release-plan` `needs: quality`, `if` push to `refs/heads/main`; `release` `needs: release-plan`, `if publish == 'true'`. No status function in the `if`s, so the implicit `success()` applies: a failing gate skips both later jobs and nothing is built, tagged or published.
- **Permissions:** workflow `contents: read`; only `release` raises it to `contents: write`.
- **Concurrency:** one group per ref; `cancel-in-progress` only off `main`. On `main` runs queue; GitHub keeps at most one pending run per group, so a run waiting behind another can be replaced by a newer push (ADR-003 §4 states this). The replaced run publishes nothing, which leaves a gap in the numbers (allowed).
- **Tag loop:** the tag is created by `GITHUB_TOKEN` when publishing, which does not trigger workflows, so no extra run.
- **Secrets:** read through step `env`, never inlined into `run:` text; the keystore is decoded with `umask 077` into `$RUNNER_TEMP` and deleted with `if: always()`; no `upload-artifact`; nothing echoes a secret (`printf … | base64 --decode > file`). Gradle receives the passwords as `-P` arguments (masked in logs; visible only in the process list of the ephemeral runner).
- **Variables:** `ANDROID_CERT_SHA256` (`vars`) checked in `release-plan` and used in `verify-certificate`; `BUILD_NUMBER_OFFSET` optional (empty → 0, otherwise a whole number ≥ 0, else the job fails).
- **Failure cleanup:** draft created with the APK, then published; `Remove an unfinished draft release` runs on `failure() || cancelled()` and deletes only a draft (`gh release view` falls back to drafts by tag name). A failure before `gh release create` leaves nothing behind.

### Tests and files added or changed by QA

- `src/modules/updates/domain/release-ci-format.test.ts` (new, 16 tests): CI's `tooling/release/release-format.js` and the app's `parseRelease` agree on the tag prefix, the Android maximum, every release CI can publish (fast-check over all build numbers: parsed with the same build number and asset name) and on accept/reject for 14 edge tags (`build-0`, `build-01`, `build-2100000001`, `Build-42`, trailing space, `1e3`, …). Seen red: temporarily letting CI accept leading zeros made 2 tests fail; the file was restored byte for byte.
- `src/modules/updates/domain/release.test.ts` (6 tests appended): every `parseRelease` error carries a readable message (killed the 6 surviving string mutants).
- `e2e/flows/smoke-tabs.yaml` and `e2e/README.md`: the Expo Go smoke flow now asserts that no update dialog appears (`Later` not visible) and that Settings shows "Version … (development build)". Not run (needs Maestro, adb and a device).
- No production code changed.

---

## Architect design review (close-out, 2026-11-14)

Scope: all Phase 2 code (`src/modules/updates/**`, `src/shared/infrastructure/app-info/**`,
`src/shared/domain/build-number.ts`, `src/modules/settings/presentation/**`, composition root,
`test/{fakes,builders,contracts,support}` additions) and the QA-05-1 fix. Checked: layering,
typing, naming, duplication, patterns, test quality. No layer violation, `any`, cast, disabled
test or business rule in UI/infrastructure found. Every adapter sits behind a port and passes a
shared contract suite. The use cases are tested with fakes, and the view model is an explicit,
tested state machine.

### Rulings on the open points

| # | Point | Ruling |
|---|---|---|
| a | `updates/presentation/update-texts.ts` (MB, percent, error texts) in presentation | **Accepted, stays.** It is display formatting (a Presenter: pure functions, unit tested) and decides nothing about updates. The only rule-like value it uses (`totalBytes`) comes from the port. Promote `formatMegabytes` to `shared/ui` when a second module formats sizes (rule of three). The `updates.downloadCancelled` entry in `FAILURE_TEXTS` is unreachable in practice (cancel leads to `dismissed`), but it keeps the map exhaustive over `UpdateFailure['code']`, so a new error code fails `tsc` until it gets a text. Accepted. |
| b | `PromptButton` local to `updates/presentation` vs `shared/ui` | **Accepted for this sprint; backlog B05-1.** One consumer today; the TSDoc already says to promote it. Sprint 1 (exercise/routine forms) brings the second consumer, so the first Sprint 1 UI story moves it to `shared/ui` as `Button`, with `MIN_TOUCH_TARGET_SIZE` / `PRESSED_OPACITY` becoming theme tokens. Moving it now would be a speculative design-system API with one user. |
| c | `update-prompt.test.tsx` at 408 lines (target 250) | **Fixed.** Split by story into `update-prompt.test.tsx` (S05-08 + root layout, 115 lines), `update-prompt-download.test.tsx` (S05-09), `update-prompt-install.test.tsx` (S05-10) and `use-update-flow.test.tsx` (double taps). The shared stubs and container moved to `test/support/update-prompt-harness.tsx` (own test), which `update-prompt-remount.test.tsx` now reuses too. Same 24 tests, same assertions; the root-layout test now renders through the real `AppShell`. |
| d1 | core-dev's extra `test/contracts/apk-installer.contract.ts` | **Accepted (good).** Liskov for the installer port as for the others; added to ADR-003 §11. |
| d2 | Extra adapter exports: `HttpGet` / `HttpGetOptions` / `HttpResponse`, `NativeAppReadings`, `UNKNOWN_VERSION` | **Accepted.** `HttpGet` is the adapter's HTTP seam (the composition root passes `fetch`, tests pass a stub); `NativeAppReadings` is the constructor input that keeps the native boundary in `readExpoAppReadings`; `UNKNOWN_VERSION` is a named constant instead of a magic string. None is exported from a module `index.ts`, so they stay infrastructure-internal. |
| d3 | `warn` log level for download/installer failures | **Accepted.** These are expected operational failures (network, user deleted the file), handled with Retry, like the check failures (`warn` too). `error` stays reserved for unexpected failures (e.g. startup). |
| e | `react-native-reanimated` / `react-native-worklets` in the APK vs ADR-001 wording | **Wording fixed in ADR-001 §1.** They were removed as *direct* dependencies, but arrive transitively (`expo-router`, `expo-modules-core`), and since SDK 54 Expo autolinks transitive React Native modules, so their native code is in the release APK. Both are part of Expo Go; no development build needed. **Backlog B05-2:** measure the APK size share and decide on `expo.autolinking.android.exclude` only after checking on a device that expo-router doesn't need them at runtime (excluding them blindly could crash navigation). |

### Other findings and changes at close-out

- QA-05-1 fix reviewed and approved: the store is a port-shaped interface in the application layer
  with a DI token, registered as a per-container singleton (no module-level mutable state), and the
  state machine starts from it through `initialUpdateFlowState`. Interfaces section, composition
  root list and ADR-003 §11 updated; S05-14 step 3.4 now expects the dialog **not** to come back.
- QA-05-3 (TDD): `src/core/presentation/app-shell.test.tsx` written first and seen failing (module
  missing), then `app-shell.tsx`. Mutation check: moving `{overlay}` outside the gate fails 2 of
  the 3 tests. `app/_layout.tsx` is now three lines of JSX.
- QA-05-4: CI hardened (see the bug table). No test reads the workflow file; YAML validated.
- Removed the leftover `.gitkeep` files from the now populated `updates/{domain,application,infrastructure}`.
- Accepted: `src/modules/updates/infrastructure/github-release-source.test.ts` is 292 lines
  (contract run + configuration, request, mapping, HTTP failure and timeout groups for one
  adapter). **Backlog B05-3:** split it by group (e.g. a `-timeout.test.ts`) next time it changes.
- Accepted: `use-app-version.ts` has no own test file; it is a one-line hook covered through
  `settings-screen.test.tsx` (both labels) and `app-version-label.test.ts`.

### Backlog items from this review (to be moved into `BACKLOG.md` with the user)

| ID | Item |
|---|---|
| B05-1 | Promote `PromptButton` to `shared/ui` `Button` (+ theme tokens) with the first Sprint 1 UI story that needs a button. |
| B05-2 | Measure the size of the reanimated/worklets native code in the APK; consider an autolinking exclude only after a device check. |
| B05-3 | Split `github-release-source.test.ts` (292 lines) by behaviour group. |
| B05-4 | `BACKLOG.md` still calls `updates` a placeholder; update it with the user at review. |

### Remaining user actions

1. Create the keystore and configure the 4 secrets + the `ANDROID_CERT_SHA256` variable (README
   "Release setup"; checklist step 0).
2. Push `main` to `difcortesgu/ExerciseTracker` and check the first release run (checklist 1).
3. Run the on-device checklist S05-14 (steps 2 to 8) and report the results.
4. Confirm or override the assumed answers Q1 to Q6.

