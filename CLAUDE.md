# Project Context for Claude

## What this is
**fplang** — a factor / alpha expression language for FPL (Fantasy Premier League) analytics.
Users define named derived attributes ("factors") from base data in a simple expression language:
```
xg_over = goals_scored - expected_goals
captain = z(form) + z(fixture_ease) + z(xg_over)
```
The language is browser-native (runs in-editor with zero latency) and node-ready (CLI/REPL/backtest).
Design spec: see `docs/` (migrated from `fpl-elite/.project/dsl/`).

## Tech stack
- **Language:** TypeScript (ESM, strict)
- **Runtime:** Node (CLI/REPL/test) + browser (via `npm run build` dual ESM/CJS output)
- **Test runner:** Vitest
- **Build:** tsup (dual ESM/CJS + .d.ts declarations)
- **Dev runner:** tsx (for bin/ entrypoints without a build step)
- **No framework, no bundler for dev** — pure TS library

## Commands
```
npm run run    -- <file.factors> [flags]   # file runner
npm run repl                               # interactive REPL
npm run llm    -- "<ask>" [flags]          # LLM generation harness
npm test                                   # vitest (watch mode)
npm run test:run                           # vitest single run
npm run build                              # tsup → dist/
npm run typecheck                          # tsc --noEmit
npm run snapshot                           # regenerate datasets/fpl-2025-26/raw/
```

## Key constraints & preferences
- **The language is computation only.** Filter/sort/column-selection are CLI flags or REPL commands — never DSL syntax.
- **span-aware front-end required.** Every token carries `{ from, to }` character offsets so the public API can drive CodeMirror diagnostics/hover.
- **No expr-eval.** The engine uses a real AST + compiled closures, not a third-party expression evaluator.
- **6 decimal places** at the factor boundary (results rounded before being stored as column values).
- **Columnar data model.** Player rows are Float64Array columns (not JS object arrays), history is Arrow ListArray shape.
- **Class propagation.** A factor that references an XS or TS factor is promoted to at least that class.
- **Null semantics.** Arithmetic with a null operand → null; Infinity/NaN → null; series() only inside ts_* calls.
- **Multi-source data (ADR-002).** Each data source is an independent repo implementing the `DataSource` contract. Fields from non-default sources are addressed as `source.field` in factor expressions. The `fpl` source is the default; its fields resolve bare or prefixed. See `docs/11-data-sources.md`.

## What's in progress right now
Engine Phase 1 is complete (lexer → parser → sema → scalar runtime → REPL). Up next:
- **019–022:** multi-source grammar + DataSource contract + Panel merge (ADR-002)
- **010:** cross-sectional runtime (rank/z/quantile)
- **011:** time-series runtime (ts_mean/delta/std)
- **009/013:** run.ts + llm-harness.ts bin/ entrypoints

## Where to find things
- **Language spec:** docs/ (README + 01-usecases through 11-data-sources)
- **Architecture decisions:** .project/decisions/ (ADR-001 = language/runtime; ADR-002 = multi-source data)
- **Backlog:** .project/backlog/BACKLOG.md
- **Sample factor libraries:** factors/ (scoring.factors, momentum.factors, captain.factors)
- **Offline data loader (fpl source):** data/loadSnapshot.ts + datasets/fpl-2025-26/raw/
- **Multi-source spec:** docs/11-data-sources.md
- **Skills:** .claude/skills/

## Workflow habits
- Mark backlog items done immediately after implementing them.
- When committing, include [NNN] ticket IDs in the message (hook auto-marks them done).
