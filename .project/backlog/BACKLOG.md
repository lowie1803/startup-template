# fplang Backlog

## Open

| ID  | Type    | Description                                               | Priority | Status |
|-----|---------|-----------------------------------------------------------|----------|--------|
| 009 | bin     | run.ts file runner                                        | P1       | todo   |
| 010 | engine  | Cross-sectional: rank/z/quantile/scale/demean (Tier 2)   | P1       | todo   |
| 011 | engine  | Time-series: ts_* over ListArray history (Tier 3)        | P1       | todo   |
| 013 | bin     | llm-harness.ts LLM generation harness                    | P2       | todo   |
| 014 | docs    | docs/design/architecture.md — locked decisions + ladder  | P1       | todo   |
| 017 | engine  | expected_minutes(n) / xgw_pts(n) parameterized factors   | P2       | todo   |
| 018 | engine  | goal_points/cs_points/assist_points domain lookup fns    | P1       | todo   |
| 019 | engine  | Dotted names: lexer + parser → QualifiedName AST node    | P1       | todo   |
| 020 | engine  | Sema: resolve qualified names; source-aware catalog + diagnostics | P1 | todo |
| 021 | data    | DataSource interface + source registry; merged catalog   | P1       | todo   |
| 022 | data    | Panel merge / join-on-id utility (mergePanels)           | P1       | todo   |
| 023 | data    | Refactor loadSnapshot.ts into fpl reference DataSource   | P2       | todo   |

## Done

| ID  | Type    | Description                                               | Completed  |
|-----|---------|-----------------------------------------------------------|------------|
| 001 | engine  | Lexer — span-aware tokenizer                              | 2026-06-03 |
| 002 | engine  | Parser — Pratt parser → typed AST                        | 2026-06-03 |
| 003 | engine  | Dep graph + Kahn topo sort + cycle detection              | 2026-06-04 |
| 004 | engine  | Classify factors (scalar/xs/ts) + class propagation       | 2026-06-04 |
| 005 | engine  | Typecheck pass — span diagnostics                         | 2026-06-04 |
| 006 | engine  | Panel (columnar Float64Array) data model                 | 2026-06-03 |
| 007 | engine  | Scalar runtime: builtins + compiled closures              | 2026-06-03 |
| 008 | engine  | Public API: parse / analyze / evaluate / listFields       | 2026-06-03 |
| 012 | bin     | repl.ts interactive REPL                                  | 2026-06-03 |
| 015 | data    | data/loadSnapshot.ts — columnar panel from JSON snapshot  | 2026-06-04 |
| 016 | cleanup | Remove sandbox/ from fpl-elite + pointer stub            | 2026-06-03 |

## Notes

- **008** is now fully wired: `analyze()` uses real dep graph, topo sort, classification,
  and typecheck (003/004/005). The stub is gone.
- **016** closed: `sandbox/` never existed in `fpl-elite` — no action needed.
- **018** added: `goal_points(position)`, `cs_points(position)`, `assist_points` are
  stubbed in `src/runtime/builtins.ts` with a clear error. Unblocks `scoring.factors`.
- **sema catalog**: `src/catalog/functions.ts` is the single source of truth for function
  signatures, arity, and class. The runtime `BUILTINS` registry (Tier 1 only) is separate.
- **019–023** implement ADR-002 (multi-source data). Rationale in
  `.project/decisions/ADR-002-multi-source-data.md`. 022 is the constrained join-on-id
  form for source panel merge — not the deferred general pipeline join primitive.

## Inbox
