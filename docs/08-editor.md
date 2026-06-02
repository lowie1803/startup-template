# Editor — CodeMirror Integration

The DataLab editor (CodeMirror 6 via `@uiw/react-codemirror`) already has syntax highlighting,
linting, and autocomplete wired to the DSL. This document describes the **gaps to fill** and
**new capabilities** needed for the factor DSL.

All existing tooling is in `client/src/lib/codemirror/dslLang.js`, exported as `dslExtensions`.

---

## What already exists

| Feature | Status | Notes |
|---|---|---|
| Syntax highlighting | ✓ | StreamLanguage tokenizer; keywords, strings, numbers, operators |
| Linting | ✓ | Wraps `parsePipeline()` — structural errors only |
| Keyword autocomplete | ✓ | 8 keywords with `detail` and `apply: 'keyword: '` |
| Source name autocomplete | ✓ | From `ALL_SOURCE_NAMES` |
| Field autocomplete | ✓ | From active source's `fields[]` (context-aware by `source:` line) |
| Function autocomplete | ✓ | `DSL_FUNCTIONS` + `MATH_FNS` + `AGG_FNS` |
| Theme | ✓ | `el-*` CSS variables, `{ dark: true }` |
| Line numbers | ✓ | `basicSetup` |
| Active line highlight | ✓ | `basicSetup` |
| Bracket matching | ✓ | `basicSetup` |
| Lint gutter | ✓ | `lintGutter()` |

---

## Gaps to fill

### 1. Factor names in autocomplete

Currently autocomplete only knows about base fields (from the source catalog) and built-in
expr-eval functions. Factor names (builtin and user-defined) are invisible to the editor.

**Fix**: extend `dslCompletionSource` to merge factor names into the completion list alongside
base fields:

```
[ ...fieldOptions, ...factorOptions, ...fnOptions ]
```

Each factor completion should include:
- `label`: factor name
- `type`: `'variable'` (distinct icon from functions)
- `detail`: the factor's description (one-line)
- `info`: the factor's formula (shown in the detail panel — see hover below)

### 2. Cross-sectional & time-series function completions

The new operators (`rank`, `z`, `zscore`, `quantile`, `scale`, `demean`, `ts_mean`, etc.) are
not in the current function lists. Add them with signature-aware `apply` strings:

```
{ label: 'rank',    apply: 'rank(',    detail: 'rank(expr) or rank(expr, group)' }
{ label: 'z',       apply: 'z(',       detail: 'z-score over all players' }
{ label: 'ts_mean', apply: 'ts_mean(series(', detail: 'ts_mean(series(field), n)' }
{ label: 'series',  apply: 'series(', detail: 'series(field) — per-GW history' }
```

Position helpers should also be completions:
```
{ label: 'goal_points',   apply: 'goal_points(', detail: 'GKP:6  DEF:6  MID:5  FWD:4' }
{ label: 'cs_points',     apply: 'cs_points(',   detail: 'GKP:4  DEF:4  MID:1  FWD:0' }
{ label: 'assist_points', apply: 'assist_points', detail: 'Constant: 3' }
```

### 3. Hover tooltips (new)

`hoverTooltip` from `@codemirror/view` shows a popup when the cursor rests on a token.

For **base fields**: show the field's description from the catalog.
For **factor names**: show the factor's description + formula.
For **functions**: show the function signature + one-sentence description.

```
hover over `expected_goals`:
  → "xG — expected goals"

hover over `point_from_goals`:
  → "goals_scored * goal_points(position)"
     "Attribution: FPL points earned from goals (6/6/5/4 by position)"

hover over `rank`:
  → "rank(expr [, group]) → percentile 0–1
     Omit group to rank over all players.
     Negate expr to rank descending: rank(-value)"
```

### 4. Semantic linting (new)

Currently the linter only surfaces structural parse errors from `parsePipeline()`. The factor
engine exposes richer semantic errors: unknown field/factor names, type mismatches, cycles.

**Extend `dslLinter`** to also run the factor engine's parse + validate step (not the full
evaluation — just the dependency graph and name resolution) and surface:

| Error kind | Diagnostic |
|---|---|
| Unknown identifier `foo` in expression | `"Unknown field or factor: 'foo'"` |
| Cycle: `a → b → a` | Both `a` and `b` lines get: `"Circular dependency: a → b → a"` |
| `series()` outside a `ts_*` call | `"series() can only appear inside ts_mean, ts_delta, …"` |
| Wrong type in arithmetic | `"'team' is a string — cannot use in arithmetic"` |
| Reserved name used as factor name | `"'rank' is a reserved function name"` |

Diagnostics carry `severity: 'error'` or `'warning'` and include the `from`/`to` character
range of the offending token (not just the line), enabling underline highlighting.

### 5. Snippets (new)

Snippet completions insert a template expression when selected, advancing the cursor to the
first fill-in point. Useful for the harder-to-remember patterns:

| Trigger | Inserts |
|---|---|
| `xg` | `xg_over = goals_scored - expected_goals` |
| `captain` | `captain = z(form) + z(fixture_ease) + z(xg_over)` |
| `rank_pos` | `rank(${expr}, position)` |
| `ts5` | `ts_mean(series(${field}), 5)` |
| `iff_pos` | `iff(position == "${POS}", ${then}, 0)` |
| `coalesce` | `coalesce(${field}, 0)` |

Snippets appear in the autocomplete list with `type: 'text'` and a snippet icon.

---

## Factor editor (live preview pane)

The **factor editor** in the Factor Library panel uses a dedicated single-expression
CodeMirror instance (no pipeline keywords — just expression syntax). It shares `dslExtensions`
(minus the keyword tokenizer; just expression highlighting + lint + autocomplete).

As the user types, the editor:
1. Runs the expression through the factor engine on the current player data (debounced 300ms).
2. Shows a **distribution summary** beside the editor: min, median, max, and a tiny sparkline
   histogram of the value distribution across all players.
3. Shows a **top-5 table**: the 5 players with the highest value for this factor.

This tight feedback loop is the primary UX improvement over the current `compute:` workflow,
where you have to run the whole pipeline to see any output.

---

## Editor extension structure (updated `dslLang.js`)

```js
// Stable extension array — all new features added here
export const dslExtensions = [
  dslHighlight,          // existing StreamLanguage tokenizer
  dslLinter,             // existing parsePipeline() + NEW semantic lint
  lintGutter(),
  dslAutocomplete,       // existing + factor names + XS/TS functions + snippets
  dslHoverTooltips,      // NEW hoverTooltip() for fields, factors, functions
  dslTheme,              // existing el-* theme
];
```

The `dslExtensions` export remains a stable array (no per-render closures). Factor names
are injected via a `StateField` or a facet that the Zustand store updates when factors change,
so the autocomplete list stays in sync without remounting.
