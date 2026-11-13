# Builders

Fluent test data builders (object mothers), e.g.
`aRoutine().withBlock(aBlock().repeat(3).with(anExerciseStep())).build()`.

Conventions:
- **One builder per aggregate / node type**, in `<aggregate>.builder.ts`, exported as `a<Name>()` /
  `an<Name>()`.
- `build()` returns a **valid** domain object by default (sensible defaults); tests override only the
  fields that matter for the behaviour under test.
- Builders are immutable: every `with…` call returns a new builder.
- IDs come from a deterministic sequence (no randomness) so failures are reproducible.
- Tests use builders instead of hand-written fixtures (DRY in tests). If you copy a fixture twice,
  add a builder method.
- Builders construct objects through the domain factories, never by bypassing validation with casts.
