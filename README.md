# Exercise Tracker

Expo + React Native + TypeScript exercise tracker for Android, run through **Expo Go**, with local
SQLite storage. Product plan: [`PLAN.md`](PLAN.md). Engineering rules (mandatory):
[`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md). Architecture decisions:
[`docs/adr/`](docs/adr/). Current sprint: [`docs/sprints/`](docs/sprints/).

## Setup

```bash
nvm use            # Node 26 (see .nvmrc)
npm install
npm start          # scan the QR code with Expo Go on Android
```

Expo SDK 58. Every dependency runs in Expo Go; no development build is needed (ADR-001).

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Start the Expo dev server (QR code for Expo Go) |
| `npm run android` | Start the dev server and open it on a connected Android device/emulator |
| `npm run typecheck` | `tsc --noEmit` with strict settings |
| `npm run lint` | ESLint including the architecture boundary rules; warnings fail too |
| `npm run format` | Format all files with Prettier |
| `npm run format:check` | Report files that are not Prettier-formatted (used by CI) |
| `npm test` | Jest (app + tooling projects). Add `-- --coverage` to enforce the per-layer thresholds |
| `npm run test:mutation` | Stryker mutation testing of the domain layers (report in `reports/mutation/`) |
| `npm run e2e` | Maestro end-to-end flows in `e2e/flows` against Expo Go (see `e2e/README.md`) |
| `npm run doctor` | `expo-doctor` dependency and config checks |
| `npm run db:generate` | Generate a new versioned SQL migration from the Drizzle schemas |

Before calling any task done: `npx tsc --noEmit`, `npm run lint`, `npm run format:check`,
`npm test -- --coverage`. CI (`.github/workflows/ci.yml`) runs the same gates plus `expo-doctor`.

## Release APK and in-app updates

Every push to `main` that passes all quality gates builds a **signed release APK** in GitHub
Actions (Gradle, no EAS or Expo account) and publishes it as GitHub Release **"Build N"** with one
asset, `exercise-tracker-build-N.apk`. N only ever goes up and is the APK's Android `versionCode`.
Branches and pull requests only run the gates. Design and trade-offs:
[ADR-003](docs/adr/003-release-builds-and-self-update.md).

Good to know:

- **The release app and Expo Go are separate apps** on the phone (package
  `com.farid.exercisetracker` vs Expo Go). Installing one never replaces the other, and they don't
  share data.
- **Development in Expo Go is unchanged.** The updater is inactive there (and in any development
  bundle): no request to GitHub, no dialog. Settings shows "Version 0.1.0 (development build)".
- **Real phones only:** the APK contains only ARM code (`arm64-v8a`, `armeabi-v7a`), so it does not
  install on x86/x86_64 emulators. Use Expo Go on emulators.

### Install the app on your phone (first time)

1. On the phone, open `https://github.com/difcortesgu/ExerciseTracker/releases/latest` in the
   browser and download the `.apk` asset.
2. Open the downloaded file. Android asks once to allow your browser (or file manager) to
   **"Install unknown apps"**: allow it, go back, and install.
3. Open Exercise Tracker. Settings shows "Version 0.1.0 (build N)".

### How updates work

- At every start (once per launch, only after a successful startup) the app asks GitHub for the
  latest release. If its build number is higher than the installed one, it shows
  **"Build N available (size)"** with **Update** and **Later**. Nothing is downloaded before you
  tap Update. Offline, or when GitHub can't be reached, nothing is shown.
- **Later** hides the offer until the app is fully closed and started again.
- **Update** downloads with progress (you can cancel; on failure: **Retry** / **Close**), then a
  short note explains the next step and **Open installer** hands the APK to Android's own
  installer.
- The first time, Android asks you to allow **"Install unknown apps" for Exercise Tracker**
  itself. After that, Android still asks you to **confirm every install**: the app never installs
  silently. The update installs over the old build and keeps your data.
- Android only accepts an update signed with the same key as the installed app (see "Keep the
  keystore safe" below).

### Release setup (one time, repository owner)

Until these settings exist, every push to `main` fails in the "Plan release" job with a message
naming what is missing, and nothing is published.

1. Create the release keystore **once** (keep the passwords you choose):

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore exercise-tracker-release.keystore \
     -alias release-key -keyalg RSA -keysize 4096 -validity 36500
   ```

2. Read its SHA-256 certificate fingerprint (public information) from the `SHA256:` line:

   ```bash
   keytool -list -v -keystore exercise-tracker-release.keystore -alias release-key
   ```

3. Base64-encode the keystore on one line:

   ```bash
   base64 -w0 exercise-tracker-release.keystore > keystore.b64                 # Linux
   base64 -i exercise-tracker-release.keystore -o keystore.b64                 # macOS
   ```

4. In GitHub: repository → Settings → Secrets and variables → Actions.

   | Name | Kind | Value |
   |---|---|---|
   | `ANDROID_KEYSTORE_BASE64` | secret | contents of `keystore.b64` |
   | `ANDROID_KEYSTORE_PASSWORD` | secret | the keystore password |
   | `ANDROID_KEY_ALIAS` | secret | `release-key` (the `-alias` above) |
   | `ANDROID_KEY_PASSWORD` | secret | the key password (with PKCS12 usually the keystore password) |
   | `ANDROID_CERT_SHA256` | **variable** (not a secret) | the fingerprint from step 2; `AB:CD:…` or plain hex |
   | `BUILD_NUMBER_OFFSET` | variable, optional | whole number ≥ 0, default 0 |

   CI checks that every APK is signed by exactly this certificate before publishing it.
   Don't use an alias that appears in a release tag, title or APK name (e.g. `exercise-tracker`):
   GitHub drops any job output containing a secret value, so the APK name would arrive empty and
   the publish step would fail.
   `BUILD_NUMBER_OFFSET` is only needed if the workflow's run counter ever starts again (e.g. the
   workflow file is recreated): set it so that new build numbers are above the last published one.

5. Delete `keystore.b64` and never commit the keystore or its base64 form. Push to `main`: the run
   shows "Typecheck, lint, format, test" → "Plan release" → "Build, verify and publish the signed
   APK", and the release appears under Releases.

### Keep the keystore safe

Back up the keystore file and both passwords outside the repository (password manager or encrypted
drive). **If the keystore or its passwords are lost, no future build can install over the app
already on the phone.** You would have to create a new keystore, uninstall the app and install the
new build, and **all local data is lost** unless it was exported first (backup arrives in
Sprint 6).

## End-to-end smoke test (Maestro, local only)

Needs the Maestro CLI, `adb` and Expo Go on an Android phone or emulator (one-time setup in
[`e2e/README.md`](e2e/README.md)). With `npm start` running in another terminal:

```bash
adb reverse tcp:8081 tcp:8081                        # USB phone or emulator
npm run e2e                                          # opens exp://127.0.0.1:8081 in Expo Go
npm run e2e -- -e EXPO_URL=exp://<LAN-IP>:8081       # phone on Wi-Fi (adb wireless debugging)
```

The smoke flow (`e2e/flows/smoke-tabs.yaml`) waits for startup, then visits all 5 tabs and checks
each screen by its accessibility label.

## Mutation testing

`npm run test:mutation` runs Stryker on the domain layers only (`src/shared/domain`,
`src/modules/*/domain`); it is not part of `npm test`. Reports: a text report (score table and
every surviving mutant) printed to the terminal, `reports/mutation/index.html` (HTML) and
`reports/mutation/mutation.json` (machine-readable). To keep the text report as a file:
`npm run test:mutation 2>&1 | tee reports/mutation/mutation.txt`. The run fails below a mutation
score of 80%.

## Layout

```
app/              expo-router routes (thin: render a screen from a module's index.ts)
src/core/         di (composition root), bootstrap (startup sequence), presentation (app shell, React DI binding, startup UI)
src/shared/       domain (Result, ids, units), application (ports), infrastructure (DB, adapters), ui (design system)
src/modules/<m>/  domain / application / infrastructure / presentation + public index.ts
test/             fakes, builders, contracts (shared test support; never imported by production code)
tooling/          lint/coverage configuration as code, with tests proving the rules
```

Path aliases (defined once in `tsconfig.json`, used by tsc, Jest, Metro and ESLint):
`@core/*`, `@shared/*`, `@modules/*`, `@test/*`, `@assets/*`.
