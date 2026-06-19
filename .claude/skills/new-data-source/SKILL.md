# Skill: New Data Source

Use this skill to onboard a new fplang data source. Each stage ends with a concrete
command to run. Fix what the command reports, then move to the next stage.

---

## Stage 0 — Scaffold

Run the scaffold script to create the source directory:

```bash
bash scripts/new-source.sh <source-id> <output-dir>
cd <output-dir> && npm install
```

`source-id` must be lowercase, e.g. `understat`, `fbref`, `odds`.
`output-dir` is a separate directory (the source lives in its own repo).

This creates: `src/fields.ts`, `src/load.ts`, `src/index.ts`, `test/source.test.ts`.

---

## Stage 1 — Define fields (`src/fields.ts`)

Fill in the `FieldDef[]` array:
- One entry per field your source will provide.
- The `id` entry is already there — keep it; it must carry the FPL element id.
- For each field: set `name`, `description`, `type`, and `fill`.

**Name rules:** lowercase + underscores, no dashes, not a reserved fplang word (`rank`,
`z`, `ts_mean`, `iff`, …), not an existing `fpl` source field name.

**Fill rules:**
| Situation | Use |
|---|---|
| API always returns a value | `{ kind: 'none' }` |
| 0 when the event didn't happen | `{ kind: 'zero' }` |
| Null means something specific (e.g. "fully fit" = 100) | `{ kind: 'constant', value: X }` |
| Reasonable distribution default | `{ kind: 'mean' }` or `{ kind: 'median' }` |

Add `range: [lo, hi]` for sanity bounds — violations surface as warnings.

**Check:** run the validator. At this stage it will fail on `SHAPE_MISSING_COLUMN`
(fields are declared but the panel doesn't have them yet) — that's expected.

```bash
npx tsx <fplang>/bin/validate-source.ts src/index.ts
```

Move on when: only `SHAPE_*` errors remain, no `SCHEMA_*` or `NAME_*` errors.

---

## Stage 2 — Implement load (`src/load.ts`)

Fill in `load()`:
1. Fetch or read the raw data.
2. Normalise player rows to **FPL element ids** (integer). If your source uses player
   names, bundle a lookup table `{ name → fplId }` built from the FPL bootstrap.
3. Build one column per declared field (Float64Array for numbers, string[] for strings).
   NaN is fine here — `applyFills()` will eliminate it per your declared fill policy.
4. Return `new Panel(rowCount, columns)`.

```bash
npx tsx <fplang>/bin/validate-source.ts src/index.ts
```

Move on when: only `DENSITY_*` errors remain (if any), no `SHAPE_*` errors.

---

## Stage 3 — Fix density

If the validator reports `DENSITY_NAN` or `DENSITY_EMPTY_STRING`:
- Check the `fill` policy on the affected field in `src/fields.ts`.
- If `{ kind: 'none' }` but the raw data can be null → change to `zero`, `constant`,
  or `mean`.
- If the fill policy should work but doesn't → add a `fillMissing` override to
  `src/index.ts` for custom logic.

```bash
npx tsx <fplang>/bin/validate-source.ts src/index.ts
```

Move on when: `PASS` (exit 0). Warnings (`RANGE_VIOLATION`) are informational — review
them and tighten or widen the `range` bounds in `src/fields.ts` as needed.

---

## Done

```
PASS  ⚠ N warnings
Source 'mysource' is well-formed — ready to merge.
```

The source can now be registered and merged:

```ts
import { mergePanels, evaluate }   from 'fplang';
import { fplSource }   from 'fplang/data/fplSource.js';
import { mySource }    from './src/index.js';

const panel = mergePanels(fplSource.load(), await mySource.load());
const result = evaluate(
  'xg_over = goals_scored - mysource.example_field',
  panel,
  [...fplSource.fields, ...mySource.fields],
);
```

The test in `test/source.test.ts` becomes the regression gate — run it in CI to catch
regressions when the upstream data changes.
