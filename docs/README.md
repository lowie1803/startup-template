# Factor DSL — Design Spec

> Design documents for the FPL Elite Factor DSL.
> The engine is built; these docs are the authoritative spec it is checked against.

---

## What this is

The **Factor DSL** replaces the DataLab's current query language with an **alpha / factor library**.
The field set is multi-source: the built-in `fpl` source provides the FPL API player fields;
third-party sources (Understat, FBRef, odds APIs, …) are pluggable modules that contribute
additional fields, addressed in expressions as `source.field` (see [`11-data-sources.md`](11-data-sources.md)).
a way to define named derived attributes from base data that compose with each other, persist
across sessions, and appear as first-class fields everywhere in the app.

The mental model shifts from:

> _"Run a query, get a table."_

to:

> _"Define a metric once. Use it in the table, in other metrics, in a widget."_

---

## The central primitive: a factor

```
xg_over = goals_scored - expected_goals
```

That's it. One name, one expression. The name becomes a field you can reference in:
- another factor (`attack_over = point_from_ga - xpts_attack`)
- a player-table column (live, recalculates on each data refresh)
- a pipeline filter/sort in DataLab
- a saved widget on the dashboard

Factors compose: the engine resolves dependencies, evaluates them in the correct order, and
catches cycles. The old `compute:` step inside a pipeline becomes the definition site for a
reusable, persistent factor.

---

## What changed from the old DSL

| Old (query DSL) | New (factor DSL) |
|---|---|
| `compute: value = total_points / price` | `value = total_points / price` (defined once, reused everywhere) |
| Result exists only while the script runs | Factor is persisted; column stays in the table |
| `>> column` publishes a **static snapshot** (`formula: null`) | Column stores the **live formula**, re-evaluates on refresh |
| Per-row `expr-eval` only | Scalar + cross-sectional (`rank`, `z`, …) + time-series (`ts_mean`, …) |
| Two separate engines (DSL vs CustomColumnEditor) | One engine for all derived attributes |
| Field catalog ~28/105 raw fields | All relevant fields exposed; single source of truth |
| `filter:` / `sort:` / `show:` / `limit:` written in the editor | UI controls on the right panel — not editor syntax |
| One script = one pipeline run | Factors are permanent computed attributes; views are separate saved UI configs |

## The two panels

The DataLab has a hard split:

- **Editor (left)** — computation only. Pure `name = expression` lines. No filter, sort,
  show, or limit syntax. This is the program.
- **Result viewer (right)** — exploration only. UI controls for filtering rows, choosing
  columns, and sorting. Configurations can be saved as named **views**. This is the lens.

---

## Docs in this directory

| File | What it covers |
|---|---|
| [`01-usecases.md`](01-usecases.md) | The 13 factor families — the catalog of real FPL questions the DSL answers |
| [`02-syntax.md`](02-syntax.md) | Grammar: factor definition, operators, precedence, qualified names, comments |
| [`03-types.md`](03-types.md) | Type system: number / string / bool / series; coercion & null rules |
| [`04-functions.md`](04-functions.md) | Full function reference — scalar, position helpers, cross-sectional, time-series |
| [`05-fields.md`](05-fields.md) | `fpl` source field catalog: all FPL player fields and series fields |
| [`06-evaluation.md`](06-evaluation.md) | How the engine evaluates: dependency graph, three evaluation classes |
| [`07-features.md`](07-features.md) | Factor library lifecycle, persistence, surfaces, engine unification |
| [`08-editor.md`](08-editor.md) | Editor UX: autocomplete, hover, semantic lint, snippets, live preview |
| [`09-roadmap.md`](09-roadmap.md) | Tiers / phasing, deferred capabilities, backlog links |
| [`11-data-sources.md`](11-data-sources.md) | Multi-source data: the `DataSource` contract, namespace syntax, Panel merge, authoring guide |

---

## Quick reference

```
# Per-row arithmetic
xg_over = goals_scored - expected_goals

# Composition (reference another factor by name)
point_from_goals = goals_scored * goal_points(position)
point_from_ga    = point_from_goals + assists * assist_points

# Cross-sectional (whole column)
value_rank = rank(value, position)          # percentile within position group
captain    = z(form) + z(fixture_ease) + z(xg_over)

# Time-series (per-player GW history)
momentum = ts_delta(series(points), 3)      # last-3-GW point change
form_ts  = ts_mean(series(points), 5)       # own rolling average
```
