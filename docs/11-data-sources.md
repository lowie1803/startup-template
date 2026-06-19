# Data Sources

How fplang ingests data from multiple providers — and how to author a new one.

See also: [ADR-002](.project/../.project/decisions/ADR-002-multi-source-data.md) for the
architecture decision and rationale.

---

## Why source-as-repo

The FPL API player fields (`goals_scored`, `price`, …) are the baseline. Rich factor
libraries need more:

| Want | Provider |
|---|---|
| Higher-quality xG/xA by situation | Understat, StatsBomb |
| Defensive metrics, chance quality | FBRef, Opta |
| Implied goal / clean-sheet probability | Odds APIs |
| Calibrated fixture difficulty | Community FDR models |

Each source evolves independently, may be maintained by a different person, and has its own
schema and missing-data conventions. Coupling them all into this repo would bloat core,
create fragile API dependencies at test time, and close the door to community contribution.

The solution: **each source is a separate module (typically its own git repo)** that
implements a simple `DataSource` contract. fplang core merges the results.

---

## The `DataSource` contract

```ts
interface DataSource {
  /** Short identifier — becomes the namespace prefix in expressions. */
  id: string;                           // e.g. 'fpl', 'understat', 'opta'

  /** Fields this source provides. Declared upfront for sema / autocomplete. */
  fields: FieldDef[];

  /**
   * Return a columnar Panel of player data.
   * Column names must exactly match the `name` properties in `fields[]`.
   * Every row must correspond to an FPL element id; the panel must have an
   * `id` column (Float64Array) for the core merge step.
   */
  load(opts?: Record<string, unknown>): Panel | Promise<Panel>;

  /**
   * Optional. Fill NaN values in a column before the panel is merged into the
   * working panel. Default policy: leave as NaN (Panel treats NaN as null).
   */
  fillMissing?(col: Float64Array, fieldName: string): void;

  /**
   * Optional. Static multipliers applied per-field after load().
   * { raw_xg: 1.12 } scales the raw_xg column by 1.12 before merge.
   */
  coefficients?: Record<string, number>;
}
```

---

## Addressing fields in factor expressions

### Qualified names

Fields from non-default sources use dotted syntax:

```
xg_over = fpl.goals_scored - understat.xg
captain  = z(fpl.form) + z(understat.xg_per_90)
```

The grammar parses `source.field` into a `QualifiedName` AST node, distinct from a bare
`Identifier`. Source names are not valid factor definition names (they are reserved).

### The `fpl` default source

The built-in `fpl` source is the default. Its fields can be written bare or prefixed —
both forms are identical:

```
value = total_points / price             # bare — resolved from fpl source
value = fpl.total_points / fpl.price    # explicit prefix — same result
```

This preserves backward compatibility with all existing factor files and tests.

Non-default sources must always be prefixed. Writing `xg` alone when only `understat.xg`
is loaded is a sema error.

### Sema diagnostics for qualified names

| Situation | Error |
|---|---|
| `nope.field` — source `nope` not registered | `Unknown source 'nope'` |
| `understat.nope` — field not in that source's `fields[]` | `Unknown field 'nope' in source 'understat'` |
| Bare name not in `fpl` source or factor list | `Unknown name 'nope'` (existing error) |

---

## Panel merge — join on FPL element id

Before evaluation, source panels are merged into one working `Panel` by joining on the `id`
column (the FPL element id, integer). The `fpl` source panel is the merge base.

Core provides:

```ts
mergePanels(base: Panel, ...sources: Panel[]): Panel
```

Rules:
- Every source panel must have a numeric `id` column.
- Rows in a source not present in the base are dropped (base = fpl, which has all 841
  current players).
- Players missing from a source receive `NaN` for that source's numeric fields (Panel
  treats NaN as null), `''` for string fields.
- A source can override `fillMissing` to substitute a better default (e.g. fill missing
  `understat.xg` with `0` for players with no shots).

**Fuzzy / name-based matching is the source's responsibility.** fplang core only does
integer id equality. If a third-party dataset uses player names instead of FPL ids, the
source's `load()` must normalise to FPL ids before returning the Panel.

---

## The built-in `fpl` source

The reference implementation. Points at the FPL 2025-26 bootstrap snapshot:

| Component | Location |
|---|---|
| Field declarations | `src/catalog/fields.ts` — `FPL_FIELDS` |
| Loader | `data/loadSnapshot.ts` — `loadSnapshot()` |
| Source object | `data/fplSource.ts` — wraps the above (backlog 023) |

Fields: all FPL `elements` player fields mapped to the catalog (see [`05-fields.md`](05-fields.md)).
The `fpl` source id is registered as the default; its fields resolve bare or prefixed.

---

## Authoring a new source

Checklist for an external source repo:

1. **Declare your fields** — build a `FieldDef[]` array with `source: 'yourSourceId'`.
   Pick names that are meaningful and collision-resistant within your source namespace.

2. **Implement `load()`** — fetch/read your raw data and transform it into a `Panel`:
   - One column per declared field, as `Float64Array` (numeric) or `string[]`.
   - One row per player; column lengths must all equal `panel.rowCount`.
   - Include an `id` column (Float64Array of FPL element ids) for the merge step.

3. **Normalise to FPL ids** — if your raw data uses player names or other ids, resolve them
   to FPL element ids inside `load()`. A lookup table of `name → fpl_id` bundled with
   the source repo is the standard approach.

4. **Declare your fill-missing policy** — implement `fillMissing` if NaN is the wrong
   default for your data (e.g. a player with no shots still has `xg = 0`, not null).

5. **Declare any coefficients** — if your raw values need a fixed scaling factor to align
   with fplang's units, put it in `coefficients`. This is applied automatically before merge.

6. **Export as `DataSource`** — your module's main export should satisfy the `DataSource`
   interface from fplang core.

```ts
// example: understat-source/src/index.ts
import type { DataSource } from 'fplang';
import { Panel } from 'fplang';
import { UNDERSTAT_FIELDS } from './fields.js';
import { fetchUnderstat } from './fetch.js';

export const understatSource: DataSource = {
  id: 'understat',
  fields: UNDERSTAT_FIELDS,
  async load() {
    const raw = await fetchUnderstat();
    // … transform raw → Panel with id column …
    return new Panel(n, init);
  },
  fillMissing(col, field) {
    // xg / xa default to 0 for players with no shots on record
    if (field === 'xg' || field === 'xa') {
      for (let i = 0; i < col.length; i++) {
        if (!isFinite(col[i]!)) col[i] = 0;
      }
    }
  },
};
```

---

## Using multiple sources (app layer)

```ts
import { analyze, evaluate, mergePanels } from 'fplang';
import { fplSource } from 'fplang/data/fplSource.js';
import { understatSource } from 'understat-source';

// Build merged catalog (sema sees all fields from all sources)
const allFields = [...fplSource.fields, ...understatSource.fields];

// Load and merge panels
const fplPanel        = fplSource.load();
const understatPanel  = await understatSource.load();
const panel           = mergePanels(fplPanel, understatPanel);

// Analyze + evaluate as normal
const analysis = analyze(factorText, allFields);
const result   = evaluate(factorText, panel, allFields);
```

---

## Cross-references

- **Grammar**: qualified name syntax → [`02-syntax.md`](02-syntax.md)
- **fpl field catalog**: full FPL field list → [`05-fields.md`](05-fields.md)
- **Well-formedness standard**: validation pipeline + FillPolicy catalog → [`12-dataset-standard.md`](12-dataset-standard.md)
- **Architecture decision**: rationale, trade-offs, backlog items → [ADR-002](../.project/decisions/ADR-002-multi-source-data.md)
- **Backlog**: implementation items 019–023 → [`.project/backlog/BACKLOG.md`](../.project/backlog/BACKLOG.md)
