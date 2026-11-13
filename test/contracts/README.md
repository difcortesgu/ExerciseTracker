# Contract suites

A contract suite describes the behaviour every implementation of a port must have. It is written
once and run against each implementation (in-memory fake and real adapter), so both are proven to
be interchangeable (Liskov).

Conventions:
- One suite per port: `<port-name>.contract.ts`, exporting
  `describe<PortName>Contract(name: string, createSubject: () => Subject | Promise<Subject>)`.
- The suite registers its own `describe`/`it` blocks; each test case gets a **fresh** subject from
  the factory (fresh in-memory SQLite database for real adapters).
- The fake's test file and the adapter's test file each call the suite with their own factory.
- Adding a new port's contract must not require changing the harness (Open/Closed).
- Suites export the function that registers their cases, so `jest/no-export` is switched off for
  `test/contracts/**` in the lint config (ADR-001 §8). Don't add `eslint-disable` comments for it.
