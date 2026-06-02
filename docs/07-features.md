# Features — Factor Library Lifecycle & Surfaces

How factors are created, stored, composed, and used across the app.

---

## The two panels

The DataLab is split into two distinct concerns that never mix:

| Panel | Purpose |
|---|---|
| **Editor (left)** | Write computation programs — factor definitions only. Pure `name = expression` lines. No filter, sort, show, or limit syntax here. |
| **Result viewer (right)** | Inspect computed factor values. UI controls for filtering rows, choosing visible columns, and sorting. These configs can be saved as named **views**. |

The editor produces computed attributes. The viewer is how you explore them.

---

## Factor library

The **factor library** is the persisted collection of all factor definitions. Two tiers:

### Built-in factors (read-only)

Shipped in `client/src/lib/factorLibrary.js`. Users cannot edit or delete them but can
reference them by name in their own factors. They encode:

- FPL scoring primitives (`point_from_goals`, `point_from_assists`, `point_from_cs`, `point_from_ga`)
- Expected stats (`xg_over`, `xa_over`, `xpts_attack`, `attack_over`)
- Value / rate (`value`, `form_value`, `ppg90`, `ict_per_price`, `bps90`)
- Fixture (`fixture_ease`, `fixture_ease_att`, `fixture_ease_def`, `fixture_xpts`)
- Availability (`available`, `nailed`, `risk_adj_xpts`, `starter_trust`)
- DefCon (`defcon_rate`, `defcon_value`, `cbi90`, `defcon_floor`)
- Composites (`captain`, `differential_full`, `transfer_target`, `sell_signal`)

Built-ins are documented: description + formula shown on hover in the editor.

### User factors (editable)

Stored in Zustand `factors` slice (persisted via localStorage → DB, backlog 092):

```ts
{
  id: string,           // "factor_<timestamp>"
  name: string,         // unique identifier — no clash with builtins or reserved names
  expr: string,         // the formula
  description: string,  // optional human label
  kind: 'user',
}
```

---

## Persistence & migration

### What is stored

The formula, not pre-computed values. The factor re-evaluates on every data refresh — always
live. This replaces the current `>> column` publish which stores a **static value snapshot**
(`formula: null`) that goes stale between GWs.

### Migration path

| Current store | New |
|---|---|
| `customColumns` (published via `>> column` or `CustomColumnEditor`) | → `factors` slice |
| `savedScripts` (DSL pipeline scripts) | → kept; treated as editor content |

### Storage target

- **Phase 1**: Zustand `persist` → localStorage
- **Phase 2**: DB per backlog 092 (factors roam across devices with an account)

---

## Views — saved right-panel configurations

A **view** is a saved combination of:
- **Source** — which data source (players, teams, fixtures, live_scores, …)
- **Filters** — one or more column conditions (`position == "MID"`, `price < 7.5`, `minutes > 600`, …)
- **Visible columns** — which fields and factor columns are shown
- **Sort** — which column, which direction

Views are the right-panel equivalent of what used to be a saved DSL pipeline. They are
created by:
1. Configuring the result viewer (set filters, pick columns, choose sort)
2. Clicking "Save view" and giving it a name

Saved views appear in a list on the right panel and can be switched between instantly.
The editor content (factor definitions) is shared across all views — views are just
different lenses on the same computed data.

### Example views a user might save

| View name | Filters | Sort | Columns |
|---|---|---|---|
| "Captain picks" | `position != GKP`, `minutes > 1000`, `available > 0.9` | `captain_rank_pos` ↓ | name, team, position, form, fixture_ease, captain_rank_pos |
| "MID transfers <7.5" | `position == MID`, `price < 7.5`, `minutes > 700` | `transfer_target_rank` ↓ | name, team, price, form, value, transfer_target_rank |
| "Differentials" | `selected_by_percent < 10`, `available > 0.8` | `diff_rank` ↓ | name, team, position, price, selected_by_percent, form, diff_rank |
| "Sell candidates" | `form < 4` or `fall_pressure > 0.8` | `sell_signal` ↓ | name, team, position, form, net_transfers, sell_signal |
| "DefCon budget DEFs" | `position == DEF`, `price < 5.5`, `minutes > 700` | `defcon_value` ↓ | name, team, price, defcon_rate, defcon_value, clean_sheets |

---

## Surfaces — where a factor can be used

### 1. Result viewer

The primary DataLab surface. All defined factors appear as available columns in the result
viewer. The user turns them on/off, filters on them, sorts by them. No code required after
the factor is defined.

### 2. Player table column

Any factor can be pinned as a column in the `/players` table. It appears as a live numeric
column, sortable, formatted to 2 decimal places. Driven by the factor engine — recalculates
on each data refresh, unlike the current static publish.

### 3. Composition (factor → factor)

Factor expressions can reference other factor names. The engine resolves dependency order and
evaluates correctly regardless of definition order.

```
# reference a built-in in a user factor
my_captain = z(form, position) + z(fixture_ease) + 2 * z(captain)
```

### 4. Widgets (backlog 111)

A view (factor columns + filter config) can be pinned as a widget on the dashboard or bento
(backlog 068). The widget reruns the factor computation on each page load. This is the primary
mechanism for backlog items 077, 081, 082, 084, 071 — implemented as named views rather than
bespoke React components.

---

## Engine unification

Today there are two separate formula engines:

| Engine | Location | Used by |
|---|---|---|
| DSL expr-eval | `dslExecutor.js` | DataLab `compute:` step |
| `formulaEngine.js` | `client/src/lib/formulaEngine.js` | `CustomColumnEditor` modal |

The factor engine (`factorEngine.js`) **replaces both**:

- `CustomColumnEditor` is rewritten as a thin UI over the factor library (name + formula
  input, same engine, same field catalog, same autocomplete)
- `PlayerTable.jsx` uses the factor engine for all custom columns
- The old `formulaEngine.js` is removed after migration

---

## Factor Library UI

A panel in the DataLab alongside the result viewer.

### List view

- Two sections: Built-in (read-only, lock icon) and My Factors (edit/delete icons)
- Each row: factor name · formula · description · "Add to table" toggle · "Copy name" button

### Inline factor editor

Single-line (expandable) CodeMirror instance per factor row. Full autocomplete + lint.
As you type, a **live preview** appears:
- Distribution: min / median / max + a small sparkline histogram across all players
- Top-5 players by this factor (name + value)

This tight feedback loop replaces the old "write `compute:`, run the whole pipeline, read
the result table" cycle.

### "Add to view" button

From the factor list, clicking "Add to view" makes the factor a column in the current result
viewer and sorts by it. One-click bridge from definition to exploration.

---

## LLM grounding

Because factors are one-line expressions over a documented field set, they are naturally
LLM-generatable. Paste the grammar (`02-syntax.md`) and field catalog (`05-fields.md`) into
any LLM to get valid factor definitions.

Future addition (out of current scope): an in-app "describe in English → factor" button that
calls the Claude API, feeds it the grammar + catalog, and self-corrects on lint errors.
