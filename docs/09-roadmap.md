# Roadmap — Tiers, Phasing & Backlog Links

---

## Evaluation tiers

The factor DSL is designed in four capability tiers. Implementation proceeds in tier order
because each tier depends on the infrastructure of the previous one.

| Tier | Name | Primitives | Blocks | Status |
|---|---|---|---|---|
| **0** | Per-row scalar | Field arithmetic, helpers, `iff`, `coalesce`, `per90` | Nothing | Now — works in `compute:` today (script-local only) |
| **1** | Position-aware + composition | Position helpers, factor-name resolution, dep graph | Nothing | Phase 1 |
| **2** | Cross-sectional | `rank`, `z`, `quantile`, `scale`, `demean` with optional group | Two-phase evaluator | Phase 2 |
| **3** | Time-series | `ts_*` over `series(field)` | Per-GW history data | Phase 2 (points only), Phase 3 (full) |

---

## Phasing

### Phase 1 — Engine foundation + library (Tiers 0–1)

**Goal**: named, composable, persisted factors with position-aware helpers. No cross-sectional
or time-series yet.

Deliverables:
- `client/src/lib/factorEngine.js` — dep graph + topo sort + scalar evaluator (Tiers 0–1)
- `client/src/lib/factorLibrary.js` — builtin base-factor pack (all Tier 0–1 factors from `01-usecases.md`)
- Zustand `factors` slice with persist + `customColumns → factors` migration
- Expand field catalog (`05-fields.md` "to expose" list) in `dslSources.js`
- Fix foundational bugs: boolean scope coercion, filter error surfacing
- Unify `formulaEngine.js` into `factorEngine.js`; update `CustomColumnEditor` + `PlayerTable`
- Factor Library UI (list view + factor editor with live preview — Tiers 0–1 factors only)
- Editor: factor-name autocomplete, hover tooltips, semantic lint for unknown names/cycles
- `dslExecutor.js`: route `compute:` and field references through factor engine

**Closes**: foundational prerequisites for 068, 071, 076, 077, 081, 082, 111.

User stories enabled by Phase 1:
```
xg_over          = goals_scored - expected_goals
point_from_ga    = point_from_goals + point_from_assists
available        = coalesce(chance_of_playing_next_round, 100) / 100
defcon_value     = defensive_contribution / price
```

### Phase 2 — Cross-sectional + time-series foundation (Tier 2, Tier 3 partial)

**Goal**: rankable, z-scorable signals. Captain / differential / price-pressure factors live.
Time-series over the immediately available `gwScores` (last-5 points).

Deliverables:
- Factor engine: two-phase XS evaluator (`rank`, `z`, `quantile`, `scale`, `demean`; optional group arg)
- Factor engine: TS evaluator over `row.__history` attached from `gwScores`
- Series fields immediately available: `series(points)` (last 5 GWs, all players)
- Editor: XS/TS function completions, snippet library
- Factor Library UI: live preview includes cross-sectional context (distribution histogram)
- Ship Tier-2 builtin factors: `captain`, `differential`, `transfer_target`, `sell_signal`,
  `rise_pressure`, `fall_pressure`, `value_rank_pos`, `bonus_magnet`

**Closes**: 077 (captain suggestion), 082 (differential finder), 081 (price predictions),
068 (add factor to bento), 111 (saved DSL queries as widgets).

User stories enabled by Phase 2:
```
captain       = z(form) + z(fixture_ease) + z(xg_over)
differential  = rank(form) * (1 - selected_by_percent / 100)
momentum      = ts_delta(series(points), 3)          ← series(points) from gwScores
```

### Phase 3 — Full time-series + widgets (Tier 3 full)

**Goal**: per-GW history for all series fields; factor-backed widgets on dashboard/bento.

Blocked on: **backlog 109/064** (per-GW snapshot in `datasets/fpl-2025-26/`).

Deliverables:
- Attach full history from the snapshot to `row.__history` for all series fields:
  `series(minutes)`, `series(price)`, `series(net_transfers)`, `series(goals)`,
  `series(assists)`, `series(bps)`, `series(bonus)`
- Ship TS builtin factors: `form_ts`, `momentum` (full), `consistency`, `minutes_trend`,
  `price_momentum`, `hot`
- `<DslWidget queryId="..." />` (backlog 111) — runs a saved factor/pipeline, renders as
  table or leaderboard; used for 077 captain widget, 082 differential widget, 084 dream-team
  tracker (once joined data available)
- Dashboard bento factor pins (backlog 068, 071)

**Closes**: 064 (cost change history), 071 (dashboard enrichment), 084 (dream-team tracker —
partial; full needs join across GW dream_team data).

---

## Deferred capabilities

### Join primitive

The single biggest capability this DSL **consciously defers**. All out-of-scope use cases from
`01-usecases.md` (set-piece takers joined to players, home/away splits, cross-GW dream-team
counts) require joining across two sources on a key.

This is deferred because:
1. It substantially complicates the evaluation model (rows from two sources, matching keys,
   handling misses)
2. The use cases for it are nice-to-have (set pieces) or blocked on other data (dream-team tracker)
3. The factor engine stays fast and predictable without it

A future `join(source, on: field)` keyword in the pipeline (not in factors) is the likely path.

### LLM-assisted factor generation

Factors are one-line expressions over a finite field set — highly LLM-generatable. Paste the
grammar (`02-syntax.md`) and the field catalog (`05-fields.md`) into any LLM to generate valid
factor definitions. An in-app "describe → factor" feature (calling the Claude API, feeding grammar
+ catalog, self-correcting on lint errors) is a candidate for Phase 3 or later.

### Server-side evaluation

Currently all factor evaluation happens in the browser. For very large datasets (future: full
season snapshot) or for sharing computed results, server-side evaluation via the provider
adapter pattern (backlog 110) is the natural extension. Out of scope until the snapshot is live.

---

## Backlog items directly advanced

| Backlog | Item | Phase |
|---|---|---|
| 064 | Cost change history (needs DB) | 3 — series(price) |
| 068 | Add custom column from DataLab to bento | 2 |
| 071 | Enrich dashboard | 3 |
| 076 | Injury & availability flags | 1 — expose fields |
| 077 | Captain suggestion widget | 2 |
| 081 | Price rise/fall predictions | 2 |
| 082 | Differential picks finder | 2 |
| 084 | Dream team tracker | 3 (partial) |
| 092 | Migrate localStorage state to DB | 3 — factors slice |
| 111 | Saved DSL queries as widgets | 2–3 |

---

## Design decisions locked

| Decision | Choice | Rationale |
|---|---|---|
| Group syntax | `rank(value, position)` — positional second arg | No ambiguity (XS ops never take a numeric 2nd arg); terse |
| Time-series arg | `series(field)` wrapper | Explicit; avoids naming collision with base fields; makes the series type visible |
| `z` alias | Supported alongside `zscore` | Terse for stacking: `z(form) + z(fdr)` |
| Factor scope | Persisted library, not script-local | Reuse everywhere is the point |
| Base pack | Ship full canonical pack | Encoding FPL scoring once; strong onboarding + LLM grounding |
| Engine ceiling | All three tiers (Tier 3 gated on data) | User chose the most ambitious path |
| Join primitive | Deferred | Complexity vs. benefit; all immediately wanted use cases work without it |
