# Exercise Tracker

Expo + React Native + TypeScript exercise tracker (Android / Expo Go, local SQLite). Plan and roadmap: `PLAN.md`.

## Mandatory for all work (main session and every agent)
- Read and follow **`docs/ENGINEERING_STANDARDS.md`** before writing any code: modular Clean Architecture (domain / application / infrastructure / presentation), inward-only dependencies, ports & adapters, SOLID, DRY, design patterns where they fit, strict TDD in every layer (red → green → refactor, per-layer coverage thresholds enforced), no shortcuts.
- Work in sprints with the agents in `.claude/agents/`; stop after each sprint for user review.
- Before calling a task done, run: `npx tsc --noEmit`, `npm run lint` (includes boundary rules), `npm test -- --coverage`, and report the real results.
