# Fakes

In-memory, deterministic implementations of application **ports** (`Clock`, `IdGenerator`,
repositories, audio/notification players…). Used by use-case and screen tests instead of mocks.

Conventions:
- One fake per port, named `Fake<PortName>` (e.g. `FakeClock`, `FakeIdGenerator`,
  `InMemoryExerciseRepository` for repositories), in `fake-<port-name>.ts`.
- A fake implements the port interface from the application layer (`implements Clock`), nothing more.
  Test-only helpers (e.g. `advanceBy(duration)`) are allowed but must not change the port contract.
- **Every fake must pass the port's contract suite in `test/contracts/`** (Liskov). A fake without a
  contract suite run is not done.
- No real time, randomness, network or file system.
- Fakes are written test-first like any other code.
