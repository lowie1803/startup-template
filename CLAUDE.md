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

## What's in progress right now
Building the engine from scratch (clean TS rewrite of the old fpl-elite/sandbox/ JS prototype):
- Phase 1 (active): lexer → parser → AST → depGraph → classify → typecheck → runtime scalar
- Phase 2: cross-sectional (rank/z/quantile)
- Phase 3: time-series (ts_mean/delta/std)
- Phase 4: bin/ entrypoints (run/repl/llm-harness)

## Where to find things
- **Language spec:** docs/ (README + 01-usecases through 10-expected-minutes)
- **Architecture decisions:** .project/decisions/ (ADR-001 = language/runtime decision)
- **Backlog:** .project/backlog/BACKLOG.md
- **Sample factor libraries:** factors/ (scoring.factors, momentum.factors, captain.factors)
- **Offline data loader:** data/loadSnapshot.ts + datasets/fpl-2025-26/raw/
- **Skills:** .claude/skills/

## Workflow habits
- Mark backlog items done immediately after implementing them.
- When committing, include [NNN] ticket IDs in the message (hook auto-marks them done).
