# Dataset Well-Formedness Standard

A **well-formed dataset** is one that passes all five checks below after the fill step.
`validateDataset()` enforces this contract programmatically; it is the gate before any
dataset is used in factor evaluation.

See also: [`11-data-sources.md`](11-data-sources.md) for how sources are structured and merged.

---

## The pipeline

Every new data source goes through this sequence:

```
Source          Define            Clean             Fill              Load              Validate
(raw data)  →  (FieldDef[])   →  (normalise)   →  (applyFills)  →  (Panel)       →  (validateDataset)
              declare fields    raw → columnar    eliminate NaN     merge-ready        ok: true
              + fills + descs   id normalise      per FillPolicy
```

In code:
```ts
import { applyFills }      from 'fplang/src/sources/fill.js';
import { validateDataset } from 'fplang/src/validate.js';

const raw   = await mySource.load();
const dense = applyFills(raw, mySource.fields, mySource);
const report = validateDataset(mySource.fields, dense);
if (!report.ok) throw new Error(report.errors.map(e => e.message).join('\n'));
```

---

## The five well-formedness rules

### Rule 1 — Schema complete

Every `FieldDef` must have:
- `name` — non-empty
- `source` — non-empty source id
- `type` — `'number'` | `'string'` | `'bool'`
- `description` — non-empty human-readable string (powers autocomplete hover + the skill)
- `fill` — a `FillPolicy` (see below)

String fields may not use `mean`, `median`, or `zero` fill (those are numeric-only).

### Rule 2 — Names well-formed

- Matches `/^[a-z][a-z0-9_]*$/` — lowercase, starts with a letter, underscores ok.
- Not a reserved function name (`rank`, `z`, `ts_mean`, `iff`, …) or constant (`assist_points`).
- Unique within its source.
- No cross-source column name collision: two different sources may not both declare a field
  with the same bare name (they'd both map to the same Panel column on merge).

### Rule 3 — Shape correct

- Every declared field must be a column in the panel.
- Column length must equal `panel.rowCount` for all columns.
- Numeric/bool fields → `Float64Array`; string fields → `string[]`.
- The panel must have an `id` column that is `Float64Array`, integer-valued, and unique
  across all rows (FPL element ids, used for the source-panel merge join).

### Rule 4 — Density (global strict, all rows)

After `applyFills()`, the dataset must be **fully dense**:
- No `NaN` or `±Inf` in any numeric column, any row.
- No `''` (empty string) in any string column, any row.

This is the strict bar. Every field that can be null must declare a `FillPolicy` that
eliminates the null before validation. Call `applyFills()` before `validateDataset()`.

### Rule 5 — Range (warnings, not errors)

If a field declares `range: [lo, hi]`, values outside that range produce a **warning**.
Warnings do not affect `report.ok`. They signal data quality issues (outliers, stale data,
API bugs) without blocking evaluation.

---

## FillPolicy catalog

| `fill.kind` | Effect | Applies to |
|---|---|---|
| `'none'` | No fill — field must already be dense. Any NaN/'' → Rule 4 error. | number, string |
| `'zero'` | Replace NaN/Inf with `0`. | number |
| `'constant'` | Replace NaN/Inf/' ' with a fixed value. `{ kind: 'constant', value: 100 }`. | number, string |
| `'mean'` | Replace NaN with the mean of the finite values in the column. | number |
| `'median'` | Replace NaN with the median of the finite values. | number |

**Choosing a fill:**

| Field characteristic | Recommended fill |
|---|---|
| Always populated by the API — never null | `'none'` |
| Null means a specific known value (e.g. chance = null → fully fit = 100%) | `'constant'` |
| Stats that are 0 for players who never played | `'zero'` |
| Continuous measurement where a typical value is appropriate | `'mean'` or `'median'` |
| Not available in this source at all (e.g. `fdr` in bootstrap-static) | `'constant'` with a neutral default, documented in the description |

---

## How the `fpl` source satisfies the standard

After `applyFills(loadSnapshot(), FPL_FIELDS)`, the fpl source panel is well-formed:

| Field | Policy | Reason |
|---|---|---|
| All stats (`goals_scored`, `assists`, …) | `'none'` | FPL API always returns a value (0 for non-players) |
| `chance_of_playing_next_round` | `'constant', 100` | null from FPL means "definitely playing" = 100% |
| `fdr` | `'constant', 3` | not in bootstrap-static.json; 3 = neutral difficulty until a fixture loader is wired |
| `defensive_contribution` et al. | `'zero'` | may be absent on some element objects (pre-DefCon players) |

The proof: `validateDataset(FPL_FIELDS, applyFills(loadSnapshot(), FPL_FIELDS))` returns
`ok: true`. Removing the `fdr` fill flips it to an error — see `test/validate.test.ts`.

---

## Worked example: adding an Understat source

```ts
// understat-source/src/fields.ts
import type { FieldDef } from 'fplang';

export const UNDERSTAT_FIELDS: FieldDef[] = [
  {
    name: 'id',           source: 'understat', type: 'number',
    description: 'FPL element id — normalised from Understat player name',
    fill: { kind: 'none' },
  },
  {
    name: 'xg',           source: 'understat', type: 'number', unit: 'xG',
    description: 'Expected goals season total from Understat (situation-adjusted)',
    fill: { kind: 'zero' },   // players with 0 shots have xG = 0
    range: [0, 40],
  },
  {
    name: 'xg_per_90',    source: 'understat', type: 'number', unit: 'per 90',
    description: 'xG per 90 minutes (0 if minutes = 0)',
    fill: { kind: 'zero' },
    range: [0, 2],
  },
  {
    name: 'xa',           source: 'understat', type: 'number', unit: 'xA',
    description: 'Expected assists season total from Understat',
    fill: { kind: 'zero' },
    range: [0, 20],
  },
];
```

```ts
// understat-source/src/index.ts
import type { DataSource } from 'fplang';
import { Panel } from 'fplang';
import { UNDERSTAT_FIELDS } from './fields.js';
import { fetchAndNormalise } from './fetch.js'; // returns id-normalised rows

export const understatSource: DataSource = {
  id: 'understat',
  fields: UNDERSTAT_FIELDS,
  async load() { return fetchAndNormalise(); },
  // fillMissing not needed — FillPolicy is sufficient
};
```

```ts
// App: load + merge + validate
import { applyFills, validateDataset, mergePanels } from 'fplang';
import { fplSource }       from 'fplang/data/fplSource.js';
import { understatSource } from 'understat-source';

const fplPanel  = fplSource.load();
const ustPanel  = await understatSource.load();
const merged    = mergePanels(fplPanel, ustPanel);

// Fill and validate each source's panel independently first
const fplDense = applyFills(fplPanel, fplSource.fields);
const r1 = validateDataset(fplSource.fields, fplDense);
if (!r1.ok) throw new Error('fpl source not well-formed');

const ustDense = applyFills(ustPanel, understatSource.fields);
const r2 = validateDataset(understatSource.fields, ustDense);
if (!r2.ok) throw new Error('understat source not well-formed');

// Use merged panel in factors
const result = evaluate(
  'xg_over = goals_scored - understat.xg',
  merged,
  [...fplSource.fields, ...understatSource.fields],
);
```

---

## Cross-references

- Interface definitions: `src/types.ts` (`FieldDef`, `FillPolicy`), `src/sources/types.ts` (`DataSource`, `ValidationReport`)
- Fill implementation: `src/sources/fill.ts` — `applyFills()`
- Validator: `src/validate.ts` — `validateDataset()`
- Tests: `test/fill.test.ts`, `test/validate.test.ts`
- Source authoring: [`11-data-sources.md`](11-data-sources.md)
- Architecture decision: [ADR-002](../.project/decisions/ADR-002-multi-source-data.md)
