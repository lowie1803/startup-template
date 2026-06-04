# Syntax

A factor DSL document is a list of **factor definitions**, one per non-empty non-comment line.
There is no block syntax, no control flow, no multi-line expressions.

**What is NOT editor syntax:** filtering, sorting, column selection, and limits are UI controls
on the right panel — not keywords you type in the editor. The editor is exclusively for
computing new attributes from existing ones.

---

## Factor definition

```
name = expression
```

- `name` — identifier matching `/^[a-zA-Z_]\w*$/`. Must be unique within the library
  (checked at parse time; duplicates are an error, not a silent override).
- `=` — the only statement form. No other top-level constructs.
- `expression` — anything to the right of the first `=` on the line.

### Comments

```
# This is a comment — ignored entirely
xg_over = goals_scored - expected_goals   # inline comment also fine
```

`#` anywhere on a line causes the rest of the line to be ignored.

### Blank lines

Ignored. Use them freely for readability.

---

## Expressions

### Literals

| Kind | Examples |
|---|---|
| Number | `42`, `3.14`, `-0.5`, `1e3` |
| String | `"GKP"`, `"DEF"`, `"MID"`, `"FWD"` |

### Identifiers

A bare identifier matches `/^[a-zA-Z_]\w*$/`. The engine resolves it in this order:

1. **Field from the default `fpl` source** — e.g. `goals_scored`, `price`
2. **Factor name** — a defined factor (builtin or user-defined)
3. **Error** — unknown identifier reported as a lint diagnostic

### Qualified names

When a data source other than `fpl` is active, its fields are addressed with dotted syntax:

```
source.field
```

Examples:
```
xg_over = fpl.goals_scored - understat.xg   # explicit fpl prefix (optional)
captain  = z(form) + z(understat.xg_per_90) # bare fpl, prefixed understat
```

**Default source rule:** `fpl` is the built-in default. Its fields resolve either bare
(`goals_scored`) or prefixed (`fpl.goals_scored`) — both are identical. This preserves
full backward compatibility with existing factors.

Non-default sources **must** always be prefixed. Writing `xg` alone when only
`understat.xg` is active is a sema error (`Unknown name 'xg'`).

**Source names are reserved** — a user-defined factor cannot be named `fpl`, `understat`,
or any other registered source id. The sema pass enforces this.

Grammar note: `source.field` is parsed into a `QualifiedName` AST node (`{ kind: 'QualifiedName', source, field, span }`), distinct from a bare `Identifier`. The parser recognises the pattern `Identifier DOT Identifier` and checks whether the first part is a known source id.

See [`11-data-sources.md`](11-data-sources.md) for how sources are defined and registered.

### Arithmetic operators

Standard precedence (high → low):

| Operator | Meaning | Example |
|---|---|---|
| `**` | exponentiation (right-assoc) | `price ** 2` |
| `- x` | unary negation | `-fdr` |
| `* / %` | multiply, divide, modulo | `goals_scored * 6` |
| `+ -` | add, subtract | `goals - expected_goals` |

Use parentheses freely to make precedence explicit:
```
xpts_attack = (expected_goals * goal_points(position)) + (expected_assists * assist_points)
```

### Comparison operators

Return `1` (true) or `0` (false):

| Operator | Example |
|---|---|
| `== !=` | `position == "FWD"`, `status != "a"` |
| `< <= > >=` | `minutes > 1500`, `price <= 5.0` |

### Logical operators

| Operator | Notes |
|---|---|
| `and` | both operands truthy (non-zero / non-empty) |
| `or` | either operand truthy |
| `not` | inverts truthiness |

```
nailed_mid = position == "MID" and minutes > 1700
```

### Function calls

```
fn(arg)
fn(arg1, arg2)
```

For cross-sectional ops, the optional **second arg is always a grouping field name** (a bare
identifier, not an expression). This position is never a numeric value, so there is no parsing
ambiguity:

```
rank(value, position)     # rank within each position group
rank(value)               # rank over all players
```

For time-series ops, the first arg is always a `series(field)` wrapper:

```
ts_mean(series(points), 5)
ts_delta(series(points), 3)
```

See [`04-functions.md`](04-functions.md) for the full function reference.

---

## Composition

A factor expression may reference other factor names as if they were base fields:

```
point_from_goals = goals_scored * goal_points(position)
point_from_ga    = point_from_goals + assists * assist_points
captain          = z(form) + z(fixture_ease) + z(xg_over)
```

The engine resolves dependencies and evaluates in topological order. Cycles are a parse-time
error:
```
# ERROR — circular dependency
a = b + 1
b = a + 1
```

---

## Order of definitions

Factors may be defined in **any order** — the engine topologically sorts them, so a factor
can reference one defined later in the file (or in a different file, if the library spans
multiple files). Order in the source is purely cosmetic.

---

## Reserved identifiers

These names cannot be used as user-defined factor names (they are builtin functions or
constants):

`rank`, `zscore`, `z`, `quantile`, `scale`, `demean`,
`ts_mean`, `ts_delta`, `ts_sum`, `ts_std`, `ts_max`, `ts_min`,
`series`,
`goal_points`, `cs_points`, `assist_points`,
`per90`, `iff`, `coalesce`, `clamp`, `isnull`, `notnull`,
`abs`, `ceil`, `floor`, `round`, `sqrt`, `log`, `exp`, `max`, `min`.

---

## Complete example

```
# ── FPL scoring primitives ─────────────────────
point_from_goals   = goals_scored * goal_points(position)
point_from_assists = assists * assist_points
point_from_cs      = clean_sheets * cs_points(position)
point_from_ga      = point_from_goals + point_from_assists

# ── Expected stats ─────────────────────────────
xg_over     = goals_scored - expected_goals
xpts_attack = expected_goals * goal_points(position) + expected_assists * assist_points
attack_over = point_from_ga - xpts_attack

# ── Value ──────────────────────────────────────
value         = total_points / price
value_rank    = rank(value, position)

# ── Captain signal ─────────────────────────────
fixture_ease  = 6 - fdr
captain       = z(form) + z(fixture_ease) + z(xg_over)

# ── Availability discount ──────────────────────
available     = coalesce(chance_of_playing_next_round, 100) / 100
risk_adj      = xpts_attack * available
```
