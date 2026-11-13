# ADR-002: Timer strategy (timestamp-based engine, background notifications)

- **Status:** Accepted (Sprint 0). Implemented in Sprint 3 (engine, player) and Sprint 4 (background).
  Details marked *to confirm* are decided in those sprints and may get their own ADR.
- **Date:** 2026-11-12
- **Deciders:** architect (reviewed by the user at the sprint review)

## Context

The workout timer is the core of the app (PLAN.md "Timer", Sprints 3–4). It must:

- play a routine tree (ADR-001, Composite: blocks with repeats, exercise steps, rests) step by step;
- give sound, voice and vibration cues ("3-2-1", "Rest", "Next: Squats");
- keep working while the phone is locked or the app is in the background;
- run in **Expo Go on Android** (user decision). Expo Go cannot run an Android foreground service,
  cannot change the Android manifest and does not keep JavaScript running in the background;
- be deterministic and fully unit-testable (ENGINEERING_STANDARDS §4: domain 100% coverage,
  property-based tests, no real timers).

## Decisions

### 1. Timestamp-based timer: time comes from the `Clock`, never from counting ticks

- The engine never counts `setInterval` ticks. It stores **instants** (from the `Clock` port,
  `src/shared/application/clock.ts`) for what happened: when the workout started, when each pause
  began and ended, when a step was skipped or finished. Remaining and elapsed time are always
  **computed** as `f(plan, history, clock.now())`.
- Consequences: missed or late ticks, a busy JS thread and a suspended app cause no drift. After the
  app comes back, the same function gives the correct state immediately (decision 5).
- A display **ticker** (a port, e.g. `Ticker`, with an interval adapter and a manual fake) only
  asks the UI to re-render a few times per second. It never changes timer state, so its accuracy
  does not matter.
- `SystemClock` returns wall-clock epoch milliseconds and never goes backwards (ADR-001 §13). If the
  user sets the device clock back during a workout, the timer holds still until real time catches
  up instead of jumping backwards. A forward jump makes the timer skip ahead. Both are rare and
  accepted. A monotonic clock is not used, because background notifications are scheduled at
  wall-clock times and both must agree.
- Tests use `FakeClock.advanceBy(duration)`. Property tests: "for any plan and any sequence of
  `now` values, remaining time never increases while running and elapsed time + remaining time =
  step duration".

### 2. Flatten the routine tree into a linear `Step[]`

- Before playing, the validated routine (`ValidatedRoutine`, ADR-001/S0-22) is **flattened** into
  an immutable, linear `Step[]`: blocks are expanded `repeat` times, nesting is resolved, and rests
  become explicit steps (`restAfter` of each set, `restBetweenRounds` between block rounds,
  standalone `RestStep`s). No rest is emitted after the last round of a block or the last set of
  the workout. Each step keeps its origin (node path, round number, set index) for the
  "Round 2/3" and "Next: Squats" UI and for set logging.
- The player walks this list with an index. That keeps the engine simple (no tree walking at run
  time), makes "skip", "back" and "total duration" trivial, and makes background scheduling a
  simple scan over upcoming steps.
- Flattening is a pure traversal of the Composite (Iterator/Visitor). Property tests: "total
  duration of the steps = sum over the tree of durations × repeats", "number of work steps = sum of
  sets × enclosing repeats", "flattening never produces two adjacent rests from one set".
- Step kinds are a discriminated union (`work-timed`, `work-reps`, `rest`, `countdown`). How each
  kind behaves (does it have an end time, which cues it emits, how it is logged) is a **Strategy**
  per kind in a **Registry**, so new kinds (AMRAP, EMOM) are added without editing the engine
  (Open/Closed).
- *To confirm in Sprint 3 (ADR-001 open item):* where `flatten` lives. Module domains may not
  import each other. The preferred option is that flattening stays next to the Composite (routines
  domain) and is published through a routines use case as a plain `WorkoutPlan` DTO. The workout
  application layer maps it into workout's own domain `Step`s. The alternative is that the workout
  application layer maps the routines public DTO into its own tree input.

### 3. The player is an explicit state machine (State pattern)

- States: `idle → countdown → running(stepIndex) ⇄ paused → finished`. A `work-reps` step has no
  end time: it stays `running` until the user taps "done".
- The engine is a pure reducer: `(state, command, now) → state`. Each state is a small object or
  map entry that knows which commands it accepts (State pattern), so there is no large `switch`
  over state × command. Commands (`start`, `pause`, `resume`, `skip`, `back`, `completeSet`,
  `finish`) are values, which also gives undo history for the player (Command pattern, Sprint 3).
- Expired timed steps are resolved inside the reducer from `now` (`advanceTo(now)`), so a call
  after a long gap catches up several steps at once, deterministically.
- Illegal transitions (e.g. `resume` while running) return a `Result` error or are ignored by
  definition. They are never reached through `if` branches in the UI.

### 4. Cues are Observer subscribers

- The engine returns the **domain events** a transition produced (`StepStarted`, `CountdownTick`,
  `StepCompleted`, `WorkoutFinished`, …). An application-layer event bus publishes them to
  subscribers.
- Each cue is a separate subscriber behind its own port: `AudioCueSubscriber` (`AudioCuePlayer`,
  expo-audio), `VoiceCueSubscriber` (`SpeechSynthesizer`, expo-speech), `HapticCueSubscriber`
  (`HapticFeedback`, expo-haptics), and the UI store. Settings toggles (Sprint 5) decide which
  subscribers are registered. A new cue type is a new subscriber, and the engine does not change.
- A failing subscriber must not stop the timer or the other cues. The bus isolates subscriber
  errors and logs them (a Decorator around subscribers, through the `Logger` port).
- `expo-keep-awake` keeps the screen on while the player is in the foreground (works in Expo Go).

### 5. Background and lock screen: scheduled notifications + state rebuild

- On `AppState` → `background` (and when the screen locks), the application layer computes every
  **upcoming phase change** from the current state and `now`. This is a pure function
  (`upcomingTransitions(state, now, limit)`) that stops at the first open-ended (`work-reps`) step,
  at the end of the workout, or at the limit. For each change it schedules a **local notification**
  with sound and vibration at that instant through a `NotificationScheduler` port
  (expo-notifications adapter), e.g. "Rest: 60 s", "Go: Squats", "Workout complete".
- Nothing is scheduled while paused. Every scheduled id is tracked so it can be cancelled.
- On `AppState` → `active`, all timer notifications are cancelled and the state is **rebuilt** with
  the reducer from the stored history and `clock.now()` (decision 1). Cues for phase changes that
  happened in the background are not replayed. The UI shows the current step.
- Sprint 4 also persists the active session (plan + command history with instants) to SQLite on
  every command. If Android kills the backgrounded process, the app can rebuild the session the
  same way on the next start.
- Android 13+ needs the runtime notification permission. Without it, the timer still works in the
  foreground and the UI explains that background cues are off.

### 6. Expo Go limits we accept

| Limit in Expo Go (Android) | Consequence | Mitigation |
|---|---|---|
| No foreground service, no JS while backgrounded | no audio/voice cues and no live countdown while locked | scheduled notifications (sound + vibration) for each phase change; rebuild on return |
| Manifest and config plugins can't be changed | no `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` of our own, no custom notification sounds | default notification sound on a runtime-created channel; measure timing in Sprint 4 |
| Background tasks (expo-background-task) run at most about every 15 min | useless for a timer | not used |
| Remote push is not available in Expo Go | none (only local notifications are needed) | — |

All libraries in this plan (expo-audio, expo-speech, expo-haptics, expo-keep-awake,
expo-notifications for local notifications) work in Expo Go. **None needs a development build.**

### 7. Triggers for moving to a development build

We move to an Expo development build (EAS Build or local prebuild) with a real foreground service
(e.g. an ongoing notification and a native timer) if **any** of these is true. Each one is checked
in Sprint 4 and the move gets its own ADR:

1. On the user's device with the screen off, a phase-change notification arrives **more than 2 s
   late in more than 1 of 20 trials**, or any notification is missed, in a 30-minute test routine.
2. The user needs spoken cues ("Next: Squats") or custom sounds while the phone is locked.
3. Reliable timing needs exact-alarm permissions or battery-optimisation exemptions that Expo Go
   cannot declare.
4. A required feature needs a native module that is not in Expo Go, or Expo Go drops support for
   the SDK we use.

The ports above (`NotificationScheduler`, `AudioCuePlayer`, …) mean a foreground-service adapter
replaces the notification adapter at the composition root, and the domain and application layers do
not change.

## Risks to check in Sprint 4

| Risk | Why it matters | How we check it |
|---|---|---|
| **Notification timing accuracy** | Android may batch or delay inexact alarms. A rest that ends 10 s late ruins an interval workout | log scheduled vs delivered times on the device for 20+ phase changes with the screen off; trigger 1 above |
| **Android battery optimisation** (incl. OEM "app killers") | the process (Expo Go) can be killed or its alarms deferred on some vendors | test on the user's device with default battery settings; check that the session rebuild after a kill works; document the "unrestricted battery" setting if needed |
| **Doze / App Standby** | in Doze, alarms are deferred to maintenance windows, and "allow while idle" alarms are rate-limited (roughly one per 9 minutes per app). A phone lying still during a workout can enter light Doze | screen-off tests of at least 30 min with the phone lying still; `adb shell dumpsys deviceidle force-idle` on an emulator; compare against trigger 1 |
| Notification count limits | Android limits pending alarms per app (about 500). Long routines have many phase changes | schedule a bounded window (`limit`, e.g. the next 50 changes) and re-plan on return. A routine whose window runs out while backgrounded is a known limit |
| Wall-clock changes during a workout | see decision 1 | covered by `SystemClock` tests; accepted |

## Consequences

- Timer, flattening and background planning are pure domain/application code, testable with
  `FakeClock` and property tests at 100% coverage. Every Expo API sits behind a port.
- Background behaviour depends on Android delivering notifications on time. That is the main
  product risk of the Expo Go decision, and it has measurable exit criteria (decision 7).
- Sprint 3 must settle where `flatten` lives (decision 2) before implementation starts.
