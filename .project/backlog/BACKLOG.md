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
| 027 | engine  | Data Manager: ADR-003 + discovery template + skeleton stubs | P1      | todo   |
| 029 | engine  | Wire Data Manager into evaluate/analyze public API       | P2       | todo   |
| 030 | integ   | fpl-elite Lab 0.2 — CodeMirror rich editor (syntax highlight + autocomplete + lint) wired to fplang language; re-add `fplang` vite alias in fpl-elite; published custom columns feed `customColumns` slice + `projection.js` seam. Restore client deps: `@uiw/react-codemirror`, `@codemirror/{autocomplete,language,lint,state,view}`, `@lezer/highlight`. Supersedes fpl-elite [105]–[111]. See fpl-elite ADR-002. | P2       | todo   |

## Deferred

| ID  | Type    | Description                                               | Priority | Notes |
|-----|---------|-----------------------------------------------------------|----------|-------|
| 028 | data    | Implement football-data.org source via the Data Manager  | P2       | Deferred — focus on engine + fpl source first |

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
| 019 | engine  | Dotted names: lexer + parser → QualifiedName AST node    | 2026-06-04 |
| 020 | engine  | Sema: resolve qualified names; source-aware catalog + diagnostics | 2026-06-04 |
| 021 | data    | DataSource interface + source registry; merged catalog   | 2026-06-04 |
| 022 | data    | Panel merge / join-on-id utility (mergePanels)           | 2026-06-04 |
| 023 | data    | Refactor loadSnapshot.ts into fpl reference DataSource   | 2026-06-04 |
| 024 | data    | Dataset well-formedness validator (validateDataset + applyFills) | 2026-06-04 |
| 025 | data    | Dataset well-formedness skill (.claude/skills/new-data-source) | 2026-06-04 |
| 026 | data    | football-data.org capability catalog + discovery profile  | 2026-06-08 |

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
- **024–025**: `FieldDef` now requires `source`, `description`, `fill` (+ optional `unit`,
  `range`). `applyFills()` + `validateDataset()` enforce the global-strict/all-rows
  well-formedness standard. The fpl source passes after fills (fdr→3, cop→100). The skill
  walks authors through the 6-stage pipeline: source→define→clean→fill→load→validate.

## Inbox
