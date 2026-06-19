# fplang

A factor / alpha expression language for FPL (Fantasy Premier League) analytics.

Users define named derived attributes ("factors") from base player data:

```
# Scalar: per-row arithmetic and built-in functions
value   = total_points / price
xg_over = goals_scored - expected_goals
nailed  = iff(minutes > 1500, 1, 0)
ppg90   = per90(total_points, minutes)
xpts    = expected_goals * goal_points(position) + expected_assists * assist_points

# Cross-sectional: whole-column operations (rank, z-scores, percentiles)
form_rank = rank(form, position)                           # rank within position
captain   = z(form) + z(6 - fdr) + z(xg_over)            # captaincy z-stack
differential = rank(form) * (1 - selected_by_percent/100) # under-owned high-form

# Time-series (planned — backlog 011):  momentum = ts_delta(series(points), 3)
```

Factors compose via a dependency graph (topological sort). The engine classifies each factor
as scalar, cross-sectional (`rank`, `z`, `quantile`), or time-series (`ts_mean`, `ts_std`,
`ts_delta`). A factor that *references* an XS/TS factor is promoted to that class automatically.

**Browser-native and node-ready** — the same TypeScript package runs in CodeMirror (zero-latency
interactive) and in Node (CLI runner, REPL, backtests).

---

## Quick start

```bash
npm install              # install devDependencies
npm run test:run         # run the test suite (vitest)
npm run build            # emit dist/ (ESM + CJS + .d.ts)
npm run snapshot         # fetch FPL data → datasets/fpl-2025-26/raw/
```

> **Engine status:** 222 tests pass. `parse()`, `analyze()`, and `evaluate()` are fully
> implemented. The runtime evaluates arithmetic/comparison operators, **16 scalar built-ins**
> (`iff`, `coalesce`, `per90`, `clamp`, `isnull`, `notnull`, `min`, `max`, `abs`, `sqrt`,
> `log`, `exp`, `pow`, `round`, `floor`, `ceil`), **FPL domain lookups** (`goal_points`,
> `cs_points`, `assist_points`), and all **6 cross-sectional functions** (`rank`, `z`, `zscore`,
> `quantile`, `scale`, `demean`). Time-series functions (`ts_mean`, `ts_delta`, etc. — backlog
> 011) are parsed and type-checked but not yet evaluable. `listFields()` returns all 35 FPL
> fields.

---

## Public API

```ts
import { parse, analyze, evaluate, listFields } from 'fplang';

// Parse-only — span-annotated AST + parse diagnostics. Runs on every keystroke.
const { defs, diagnostics } = parse(text);

// Semantic analysis — dep graph, type checking, classification, hover/autocomplete data.
const { order, diagnostics, classifications, hoverMap, completions } = analyze(text, fields);

// Full evaluation against a columnar data panel.
const { panel, factorNames, diagnostics } = evaluate(text, panel, fields);

// Vendored field catalog (base FPL player fields).
const fields = listFields();
```

---

## Design spec

`docs/` — the authoritative language spec (migrated from `fpl-elite/.project/dsl/`):

| File | Topic |
|------|-------|
| `docs/README.md` | Overview + index |
| `docs/01-usecases.md` | Use cases + canonical factor library |
| `docs/02-syntax.md` | Expression grammar |
| `docs/03-types.md` | Type system, null semantics, 6-dp rounding |
| `docs/04-functions.md` | Built-in functions (XS, TS, math, FPL-specific) |
| `docs/05-fields.md` | Base data fields |
| `docs/06-evaluation.md` | Evaluation model, dep graph, class propagation |
| `docs/07-features.md` | Two-panel split: language is computation only |
| `docs/08-editor.md` | Editor contract (span-aware, CodeMirror substrate) |
| `docs/09-roadmap.md` | Tiers 0–3 build roadmap |
| `docs/10-expected-minutes.md` | `expected_minutes(n)` / `xgw_pts(n)` parameterized factors |
| `docs/11-data-sources.md` | Multi-source data: `DataSource` contract, qualified names, Panel merge |
| `docs/12-dataset-standard.md` | Dataset well-formedness: define→fill→validate pipeline |

---

## Using fplang from the web app

`fpl-elite/client` (`~/startup/fpl-elite`) consumes fplang as a sibling-repo dependency.

### How the link works

**`fpl-elite/client/package.json`** declares:
```json
{ "dependencies": { "fplang": "file:../fplang" } }
```

**`fpl-elite/client/vite.config.js`** adds a `resolve.alias`:
```js
fplang: path.resolve(__dirname, '../../fplang/src/index.ts')
```

During Vite dev, the alias points directly at the TypeScript source — Vite/esbuild compiles it
on the fly; no separate `npm run build` in fplang is needed. On every save to `src/index.ts` or
any future engine file, the Vite HMR picks it up immediately.

In production (`npm run build --workspace=client`), Vite resolves via the package `exports` field
→ `dist/index.js` (the compiled output of `npm run build` in fplang).

### Current state

`fpl-elite/client/src/lib/fplang.smoke.js` re-exports the four public functions. It verifies
resolution during build and documents the seam. The live `/lab` pipeline DSL (`dslParser`,
`dslExecutor`, `dslSources`, `dslFunctions`) is untouched — it's a different, shipped DSL.

### Future migration path (out of scope until the engine exists)

Once `parse()` / `analyze()` / `evaluate()` are implemented, the factor editor in the web lab
can be wired:

1. **`codemirror/dslLang.js`** — the CodeMirror linter currently calls `parsePipeline` from the
   *pipeline* DSL. A **factor editor** CodeMirror extension can be added alongside it, using
   `analyze()` from fplang for lint underlines, `hoverMap` for tooltips, and `completions` for
   autocomplete — all with no second parser.
2. **`DataLabPage.jsx`** — `listFields()` replaces the inline field list; `evaluate()` runs the
   factor text against the live player panel.
3. **`SOURCE_REGISTRY`** — fplang's `listFields()` becomes the single source of truth for base
   fields (currently split between `dslSources.js` and the sandbox harness).

Each of these is a targeted swap, not a rewrite, because the seam is set up now.

---

## Repo layout

```
src/
  lexer/    token.ts, lexer.ts          (span-aware tokenizer)
  parser/   ast.ts, parser.ts           (Pratt parser, span-annotated AST)
  sema/     depgraph.ts, classify.ts, typecheck.ts, walk.ts
  runtime/  panel.ts, values.ts, compile.ts, builtins.ts, evaluate.ts, merge.ts
  sources/  types.ts, registry.ts, fill.ts   (DataSource contract + SourceRegistry)
  catalog/  fields.ts, functions.ts
  types.ts, validate.ts, index.ts       (public API — see above)
data/
  snapshot-fpl.mjs    FPL data fetcher (npm run snapshot)
  loadSnapshot.ts     columnar Panel from offline bootstrap snapshot
  fplSource.ts        built-in 'fpl' DataSource (wraps loadSnapshot)
  sample-panel.ts     vendored 16-player panel (offline, used by REPL + tests)
bin/
  repl.ts             interactive REPL (npm run repl)
  validate-source.ts  DataSource well-formedness checker (npm run validate-source)
  run.ts              file runner — pending (backlog 009)
  llm-harness.ts      LLM generation harness — pending (backlog 013)
examples/
  quickstart.ts       runnable demo: evaluate factors against sample panel
  sources.ts          runnable demo: load/fill/validate/merge data sources
  working.factors     curated factor library (scalar only — works today)
factors/              full factor libraries (scoring/captain/momentum)
docs/                 language spec (12 design docs)
datasets/             offline FPL snapshot (gitignored raw data)
.project/             backlog + ADRs
```
