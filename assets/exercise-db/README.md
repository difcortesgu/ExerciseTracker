# Built-in exercise library (seed asset)

Generated files — do not edit by hand. Decision record: `docs/adr/004-exercise-library.md`.

| File | What it is |
|---|---|
| `exercises.json` | The seed: format version, seed version, built-in vocabularies (category, muscle, equipment with display labels) and 876 exercises (stable source key, name, category, equipment, level, force, mechanic, primary/secondary muscles, instructions, image paths with byte sizes). Compact JSON, no images. Read only by the exercises seed source adapter (lint-enforced). |
| `manifest.json` | Small metadata read without loading the seed: seed version, content hash, pinned source and licence (credits in Settings), image base URL, counts. |
| `LICENSE.md` | Verbatim copy of the upstream licence (The Unlicense) at the pinned commit. |

Source: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), pinned to commit
`f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (`tooling/exercise-db/pin.js`). Images are not bundled;
the app downloads them on demand from `imageBaseUrl` (the same pinned commit) into its own storage.

## Regenerating (after changing the pin)

```sh
COMMIT=$(node -p "require('./tooling/exercise-db/pin.js').DATASET_PIN.commit")
mkdir -p /tmp/free-exercise-db
curl -fsSL -o /tmp/free-exercise-db/exercises.json \
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/$COMMIT/dist/exercises.json"
curl -fsSL -o /tmp/free-exercise-db/tree.json \
  "https://api.github.com/repos/yuhonas/free-exercise-db/git/trees/$COMMIT?recursive=1"
curl -fsSL -o assets/exercise-db/LICENSE.md \
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/$COMMIT/LICENSE.md"
npm run exercise-db:convert -- /tmp/free-exercise-db/exercises.json /tmp/free-exercise-db/tree.json assets/exercise-db
```

The converter fails (and writes nothing) on unknown vocabulary values, empty primary muscle lists,
duplicate ids or names (S1-08 comparison), images missing from the tree, or a malformed existing
manifest. The seed version stays the same when the content is unchanged and goes up by one when it
changed, so the app re-seeds exactly when the data changed (S1-12). Re-check the licence (data and
images) whenever the pin changes.
