# Evaluation Model

How the factor engine turns a set of factor definitions and a table of player rows into a
table of rows enriched with computed factor values.

---

## Overview

```
Factor definitions         Player rows (from source)
        │                         │
        ▼                         ▼
  ┌─────────────────────────────────────┐
  │  1. Parse + validate                │
  │     – unique names                  │
  │     – reserved word check           │
  └──────────────────┬──────────────────┘
                     │
  ┌──────────────────▼──────────────────┐
  │  2. Dependency graph + topo sort    │
  │     – detect cycles                 │
  │     – determine eval order          │
  └──────────────────┬──────────────────┘
                     │
  ┌──────────────────▼──────────────────┐
  │  3. Classify each factor            │
  │     ├─ Scalar                       │
  │     ├─ Cross-sectional              │
  │     └─ Time-series (+ cross)        │
  └──────────────────┬──────────────────┘
                     │
  ┌──────────────────▼──────────────────┐
  │  4. Evaluate in topo order          │
  │     – scalar: per-row expr-eval     │
  │     – XS: two-phase (col → inject)  │
  │     – TS: per-player history reduce │
  └──────────────────┬──────────────────┘
                     │
                     ▼
           Enriched rows[] + errors[]
```

---

## Step 1 — Parse & validate

Each factor definition is parsed into:

```js
{ name: string, expr: string, deps: string[] }
```

`deps` is the list of identifiers in `expr` that resolve to other factor names (not base fields
or functions). Validation at this stage:

- Duplicate names → error
- Reserved identifiers used as names → error
- Syntactically invalid expression → error (expr-eval parse attempt)

Errors here block evaluation entirely for the affected factor and all factors that depend on it.

---

## Step 2 — Dependency graph & topological sort

A directed graph: `name → deps`. Edges point from a factor to the factors it depends on.

**Topological sort** (Kahn's algorithm): factors with no dependencies are placed first;
their dependents are unlocked in dependency-completion order. This ensures a factor is always
evaluated *after* the factors it references, regardless of definition order in the source.

**Cycle detection**: if the graph contains a cycle, every factor in the cycle is an error.
The rest of the factors (not in the cycle) can still evaluate.

```
# Cycle example — both flagged as errors
a = b + 1
b = a + 1
```

---

## Step 3 — Classification

Each factor is classified by inspecting its expression AST:

| Class | Detection |
|---|---|
| **Scalar** | No `rank/z/zscore/quantile/scale/demean` call anywhere in the AST; no `series()` |
| **Cross-sectional (XS)** | Contains at least one `rank/z/zscore/quantile/scale/demean` call |
| **Time-series (TS)** | Contains at least one `ts_*` call (with a `series(...)` arg) |
| **XS+TS** | Contains both — evaluated in a combined two-phase pass |

A factor that references an XS or TS factor (via composition) is **promoted** to at least that
class, even if its own expression contains no XS/TS calls. The engine propagates the class
through the dependency graph.

---

## Step 4 — Evaluation

Factors are evaluated in topological order. The `rows` array is mutated (via spread) as each
factor is evaluated, so later factors can reference earlier factor values on the row.

### Class A: Scalar evaluation

For each row independently:
```
scope = { ...base_fields_as_numbers, ...already_evaluated_factor_values }
row[factor.name] = expr_eval(factor.expr, scope)
```

**Boolean coercion fix**: `true` → `1`, `false` → `0` in scope building. The current engine
silently excludes booleans; this is corrected here.

**Filter error fix**: the current pipeline's `filter:` step swallows per-row errors silently.
In the factor engine, if the expression fails to parse up-front, the whole factor errors
immediately (not silently per-row).

Values that are `Infinity`, `NaN`, or non-number → stored as `null`.
Results are not rounded at storage time (display handles rounding).

### Class B: Cross-sectional (two-phase)

1. **Inner evaluation phase**: evaluate the sub-expression inside each XS call (`rank(expr)` →
   evaluate `expr` for every row) → produces a column array.
2. **Distribution phase**: compute the distribution (mean + std for `zscore`, sort for `rank`,
   etc.), optionally grouped by the second argument field.
3. **Injection phase**: add a hidden field `__xs_<hash>` to each row with the computed value.
4. **Outer evaluation phase**: evaluate the full factor expression per-row, with `__xs_<hash>`
   substituted for the XS call node.

This means `z(form) + z(xg_over)` triggers **two** inner evaluation passes (one for `form`,
one for `xg_over`), then one outer pass summing the injected values.

Composability: `z(some_factor)` where `some_factor` is itself XS is legal — the engine
evaluates `some_factor` first (populating `row.some_factor`), then uses those values as the
inner column for the outer `z()` call.

### Class C: Time-series evaluation

Before the main evaluation pass, the engine attaches per-player history to each row:

```js
row.__history = { points: [...], minutes: [...], ... }
// most-recent-first ordering
```

History is sourced from `gwScores` (currently: last 5 GWs for points, all players) and
will be extended from the dataset snapshot when backlog 109 lands.

In the evaluation scope, `series(field)` resolves to `row.__history[field]`.
The `ts_*` function receives this array and reduces it to a scalar:

```
ts_mean([5,7,2,9,4], 5) → mean([5,7,2,9,4]) = 5.4
ts_delta([5,7,2,9,4], 3) → 5 - 2 = 3   (most-recent minus 3-ago)
```

If the history array is shorter than `n`, the function uses all available entries.
If the array is empty or the field is not present → `null`.

---

## Error handling

| Error kind | Scope | Behavior |
|---|---|---|
| Parse error | One factor | Factor and all dependents error; rest evaluate |
| Cycle | All in cycle | All cycle members error; rest evaluate |
| Unknown field/factor | One factor | Factor errors; lint diagnostic shown in editor |
| Runtime error (div by zero, etc.) | One factor, one row | `null` injected for that row; no global failure |

All errors are collected into `{ name, message }` pairs and returned alongside the enriched rows.
The UI shows them as lint diagnostics (in the editor) and as a summary panel in the DataLab.

---

## Performance considerations

- **Memoisation**: factor column values are computed once per data refresh and cached. A
  factor column in the player table does not re-run `expr-eval` on every render — only on
  source data change.
- **XS pass ordering**: multiple XS factors share inner-expression evaluation where their
  inner expressions are identical (deduplication by expression string).
- **Batch TS attach**: history is attached to all rows in one pass before evaluation, not
  per-factor.
- **Early bail**: if a factor has no dependents and is not visible in any surface (table,
  widget, pipeline), it is not evaluated. Visibility tracking is the responsibility of the
  feature layer (factor library UI), not the engine.

---

## Relation to the existing pipeline executor

The factor engine **replaces** the `compute:` step logic in `dslExecutor.js` and the
standalone `formulaEngine.js` used by `CustomColumnEditor`. It does **not** replace the
pipeline (filter/sort/limit/show/group/agg) — those steps remain in `dslExecutor.js`
and now receive factor-enriched rows as input. Factors are evaluated *before* the pipeline
runs, so `filter: value_rank > 0.8` works.
