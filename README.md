# Exercise Tracker

Expo + React Native + TypeScript exercise tracker for Android, run through **Expo Go**, with local
SQLite storage. Product plan: [`PLAN.md`](PLAN.md). Engineering rules (mandatory):
[`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md). Architecture decisions:
[`docs/adr/`](docs/adr/). Current sprint: [`docs/sprints/`](docs/sprints/).

## Setup

```bash
nvm use            # Node 24 (see .nvmrc)
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
src/core/         di (composition root), bootstrap (startup sequence), presentation (React DI binding, startup UI)
src/shared/       domain (Result, ids, units), application (ports), infrastructure (DB, adapters), ui (design system)
src/modules/<m>/  domain / application / infrastructure / presentation + public index.ts
test/             fakes, builders, contracts (shared test support; never imported by production code)
tooling/          lint/coverage configuration as code, with tests proving the rules
```

Path aliases (defined once in `tsconfig.json`, used by tsc, Jest, Metro and ESLint):
`@core/*`, `@shared/*`, `@modules/*`, `@test/*`, `@assets/*`.
