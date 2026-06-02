# fplang

A factor / alpha expression language for FPL (Fantasy Premier League) analytics.

Users define named derived attributes ("factors") from base player data:

```
value        = total_points / price
xg_over      = goals_scored - expected_goals
form_score   = z(form) + z(fixture_ease) + z(xg_over)
captain_pick = rank(form_score, position)
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

> **Engine status:** the public API types and signatures are defined (`src/index.ts`) but the
> engine implementation is pending — `parse()`, `analyze()`, and `evaluate()` currently throw
> `'fplang engine not yet implemented'`. `listFields()` safely returns `[]`.

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
  sema/     classify.ts, depGraph.ts, typecheck.ts
  runtime/  panel.ts, compile.ts, builtins.ts, crossSectional.ts, timeSeries.ts, engine.ts
  catalog/  fields.ts, builtinFactors.ts
  index.ts                              (public API — see above)
data/
  snapshot-fpl.mjs    FPL data fetcher (run: npm run snapshot)
  loadSnapshot.ts     columnar Panel loader (pending)
bin/
  run.ts              file runner (pending)
  repl.ts             interactive REPL (pending)
  llm-harness.ts      LLM generation harness (pending)
factors/              sample factor libraries (.factors files)
docs/                 language spec (11 design docs)
datasets/             offline FPL snapshot (gitignored raw data)
.project/             backlog + ADRs
```
