# End-to-end flows (Maestro)

Maestro flows for the critical user journeys, run against **Expo Go** on an Android device or
emulator. They are local/manual (not part of CI, sprint-0 decision 3). Flows live in `e2e/flows/`
and `npm run e2e` runs all of them (`maestro test e2e/flows`).

| Flow | Journey | Since |
|---|---|---|
| `flows/smoke-tabs.yaml` | app loads past the startup gate; each of the 5 tabs shows its screen and "coming soon" empty state; back to Workout | Sprint 0 (S0-25) |

## One-time setup

1. **Java 17+** (Maestro needs it): `java -version`.
2. **Maestro CLI**: `curl -fsSL "https://get.maestro.mobile.dev" | bash`, then open a new shell and
   check `maestro --version`.
3. **adb** (Android platform-tools) on your `PATH`: `adb version`.
4. **A device Maestro can drive**, either:
   - a physical Android phone with *Developer options → USB debugging* enabled, connected by USB
     (or paired with *Wireless debugging*: `adb pair` / `adb connect`), or
   - an Android emulator (Android Studio → Device Manager).

   `adb devices` must list it as `device` (not `unauthorized`).
5. **Expo Go** installed on that device from the Play Store (the version that supports SDK 58).

## Running the smoke flow

Terminal 1, start the dev server:

```bash
nvm use
npm start            # leave it running; note the exp://<LAN-IP>:8081 URL it prints
```

Terminal 2, run the flows. Pick the URL that the device can reach:

```bash
# USB-connected phone or emulator: forward the dev-server port, then use localhost (the default URL)
adb reverse tcp:8081 tcp:8081
npm run e2e

# Phone on the same Wi-Fi (adb over wireless debugging): pass the LAN URL printed by `npm start`
npm run e2e -- -e EXPO_URL=exp://192.168.1.23:8081
```

Run a single flow with `maestro test e2e/flows/smoke-tabs.yaml`. Maestro prints each step; a
failure stops the flow and saves a screenshot in the current directory (`e2e/output/` and
`.maestro/screenshots/` are git-ignored if you point `--test-output-dir` there).

### What the flow does

1. Launches Expo Go (`appId: host.exp.exponent`) and opens `EXPO_URL` (default
   `exp://127.0.0.1:8081`) as a deep link, which loads the app from the dev server.
2. Dismisses Expo Go's first-run developer-menu introduction (`Continue`) if it appears.
3. Waits up to 120 s for the `Workout screen` (the first JS bundle can be slow) and checks that
   `Startup failed` is not shown.
4. Taps Routines, Exercises, Progress, Settings and back to Workout, asserting each
   `"<Tab> screen"` accessibility label and the "Coming soon" empty state.

### Troubleshooting

- *Timeout waiting for "Workout screen"*: the device can't reach the dev server. Check the URL
  (`adb reverse` for USB/emulator, or the LAN URL on the same Wi-Fi), and that `npm start` shows
  the bundle being downloaded.
- *A permission dialog or Expo Go update prompt covers the app*: dismiss it once by hand, then
  re-run.
- *`maestro: command not found`*: open a new shell after installing, or add `~/.maestro/bin` to
  your `PATH`.

## Conventions for new flows

- Query by the same accessibility labels as the RNTL tests (labels are the contract between UI
  and tests); never by coordinates.
- One journey per file, named `<journey>.yaml`, with a header comment naming the story ID.
- Keep each journey runnable on a fresh Expo Go install (no reliance on earlier flows' data);
  add a row to the table above.
- Selectors a flow depends on are changed only together with the flow.
