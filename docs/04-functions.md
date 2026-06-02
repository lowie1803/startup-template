# Functions

All functions available in factor expressions. Grouped by class.

---

## Scalar helpers

Available in any expression, evaluate per-row.

### `iff(cond, t, f)`

Conditional. Returns `t` if `cond` is truthy (non-zero, non-null), else `f`.

```
nailed      = iff(minutes > 1500, 1, 0)
gk_value    = iff(position == "GKP", (saves/3 + point_from_cs) / price, 0)
template    = iff(selected_by_percent > 30, 1, 0)
```

All three arguments are always evaluated. Use `coalesce` to guard against null operands.

### `coalesce(a, b)`

Returns `a` if `a` is not null, else `b`. The DSL's safe-default operator.

```
available = coalesce(chance_of_playing_next_round, 100) / 100
ep        = coalesce(ep_next, 0)
```

### `clamp(v, lo, hi)`

Clamps `v` between `lo` and `hi`. Null-safe: returns null if `v` is null.

```
bounded_form = clamp(form, 0, 10)
```

### `isnull(x)` / `notnull(x)`

Return `1` / `0`. Useful in filter expressions:

```
# In a pipeline filter:
# filter: notnull(chance_of_playing_next_round)
```

### `per90(stat, minutes)`

Divides `stat` by `(minutes / 90)`. Returns null if `minutes` is 0 or null.

```
ppg90     = per90(total_points, minutes)
threat90  = per90(threat, minutes)
bps90     = per90(bps, minutes)
```

### Math (`abs`, `ceil`, `floor`, `round`, `sqrt`, `log`, `exp`)

Standard math functions from `expr-eval`. All null-safe (null in → null out).

```
log_pts  = log(total_points + 1)   # +1 to avoid log(0)
```

### `min(a, b)` / `max(a, b)`

Two-argument min/max (not to be confused with the aggregate `min`/`max` in `agg:`).

```
capped_form = min(form, 9)
```

---

## Position helpers

Encode the FPL scoring rulebook once. Used by point-attribution factors.

### `goal_points(position)`

Points awarded for a goal scored, by position.

| `position` | Returns |
|---|---|
| `"GKP"` | `6` |
| `"DEF"` | `6` |
| `"MID"` | `5` |
| `"FWD"` | `4` |

```
point_from_goals = goals_scored * goal_points(position)
```

### `cs_points(position)`

Points awarded for a clean sheet, by position.

| `position` | Returns |
|---|---|
| `"GKP"` | `4` |
| `"DEF"` | `4` |
| `"MID"` | `1` |
| `"FWD"` | `0` |

```
point_from_cs = clean_sheets * cs_points(position)
```

### `assist_points`

A named constant `= 3`. Always the same across positions; exposed as a name for readability
and consistency with `goal_points` / `cs_points`.

```
point_from_assists = assists * assist_points
```

---

## Cross-sectional operators

Operate on the **entire column** (all players in the current source), not a single row.
The engine evaluates the inner expression across all rows first, builds the distribution,
then injects the result back into each row.

All cross-sectional ops accept an **optional second argument**: a bare field name to group by.
When given, the distribution is built separately per group value, and each row is ranked/
scored within its group.

```
rank(value)              # percentile over all players
rank(value, position)    # percentile within each position
z(form, team)            # z-score within each team
```

### `rank(expr [, group])`

Percentile rank in `[0, 1]`. `0` = lowest, `1` = highest.

To rank descending, negate: `rank(-price)` gives highest price → rank 1.

```
value_rank     = rank(value, position)
captain_rank   = rank(captain, position)
rise_pressure  = rank(net_transfers)
```

### `zscore(expr [, group])` / `z(expr [, group])`

Z-score: `(x - mean) / std`. Null-safe (null values excluded from the mean/std calculation,
null input → null output). `z` is the short alias; both are valid.

The primary building block for alpha stacks, since it puts disparate metrics on a common scale:

```
captain         = z(form) + z(fixture_ease) + z(xg_over)
transfer_target = z(form) + z(fixture_ease) + z(value) + z(available)
```

### `quantile(expr [, group])`

Maps `expr` to `[0, 1]` via linear interpolation between min and max. Less sensitive to
outliers than `zscore` — useful when the distribution has heavy tails (e.g. `selected_by_percent`
is dominated by a few template players).

```
ownership_scale = quantile(selected_by_percent)
```

### `scale(expr [, group])`

Min-max scaling to `[0, 1]`. Alias for `quantile`. Prefer `quantile` for clarity.

### `demean(expr [, group])`

Subtracts the group mean: `x - mean(x)`. Keeps the original scale; useful as an intermediate
step in composite factors.

```
hot = demean(form) - demean(ts_mean(series(points), 10))
```

---

## Time-series operators

Operate on a **per-player sequence of gameweek values** (`series(field)`). The engine attaches
the per-GW history to each player row before evaluation.

First argument: always `series(fieldName)`. Second argument: `n` (number of recent GWs).

If fewer than `n` GWs are available, the function computes over however many exist.
If the history array is empty, returns `null`.

### `ts_mean(series(field), n)`

Mean of the last `n` gameweek values.

```
form_ts = ts_mean(series(points), 5)
```

### `ts_delta(series(field), n)`

Most-recent value minus the value `n` GWs ago. Positive = improving, negative = fading.

```
momentum = ts_delta(series(points), 3)
```

### `ts_sum(series(field), n)`

Sum over the last `n` GWs. Good for cumulative demand signals.

```
price_momentum = ts_sum(series(net_transfers), 3)
```

### `ts_std(series(field), n)`

Standard deviation over the last `n` GWs. Measures consistency.

```
consistency = 1 / (ts_std(series(points), 6) + 1)
```

### `ts_max(series(field), n)` / `ts_min(series(field), n)`

Maximum / minimum over the last `n` GWs.

```
ceiling = ts_max(series(points), 6)
floor   = ts_min(series(points), 6)
```

---

## Parameterized built-in factors

A special class: built-ins that take a **static integer argument** specifying a GW window.
The argument is resolved at parse time (not a runtime expression). The engine pre-computes
one result column per distinct `n` value used across all factor definitions.

### `expected_minutes(n)`

Total expected minutes the player will accumulate over the **next `n` GWs**, starting from
the current GW. Fixture-aware: blank GWs contribute 0, double GWs contribute up to 180.

```
expected_minutes(1)   # this GW only — uses GW Setup override if set
expected_minutes(3)   # next 3 GWs — GW1 uses override, GW2–3 use model
expected_minutes(6)   # next 6 GWs — model dominates, override is 1/6 of total
```

The **GW Setup override** applies only to GW1. GWs 2..n always use the model
(60% recent minutes trend + 40% season average, multiplied by `available`). This reflects
what you can actually know: team news for this week, not three weeks from now.

Blank and double GWs are handled automatically via the fixture calendar — no special syntax.

### `xgw_pts(n)`

Total expected FPL points over the next `n` GWs. Composed from appearance points,
attacking rate × expected minutes, CS probability, and bonus rate — all scaled by
`expected_minutes(n)`.

```
xgw_pts(1)   # captain/chip decision: this GW
xgw_pts(3)   # short-run transfer target
xgw_pts(5)   # medium-run squad planning
xgw_pts(2)   # DGW chip deployment — DGW players score ~2× here naturally
```

Composes freely with all other factors:

```
xgw_value_3   = xgw_pts(3) / price
captain_now   = z(xgw_pts(1)) + z(consistency)
transfer_ev   = z(xgw_pts(3)) + z(value)
dgw_rank      = rank(xgw_pts(2), position)
chip_diff     = iff(selected_by_percent < 15, xgw_pts(2), 0)
squad_build   = z(xgw_pts(8)) + z(consistency) + z(value)
```

See [`10-expected-minutes.md`](10-expected-minutes.md) for the full model, override
mechanism, and component breakdown.

---

## Aggregate functions (pipeline only)

These are used in `agg:` steps of the **DataLab pipeline**, not in factor expressions.
Listed here for completeness.

`sum(field)`, `avg(field)`, `min(field)`, `max(field)`, `count()`

```
# Pipeline example:
# group: team
# agg: xG = sum(expected_goals), n = count()
```

---

## Function quick-reference

| Function | Args | Class | Returns |
|---|---|---|---|
| `iff(c, t, f)` | any, any, any | scalar | t or f |
| `coalesce(a, b)` | any, any | scalar | a or b |
| `clamp(v, lo, hi)` | num, num, num | scalar | num |
| `isnull(x)` | any | scalar | 0 or 1 |
| `notnull(x)` | any | scalar | 0 or 1 |
| `per90(s, m)` | num, num | scalar | num |
| `abs/ceil/floor/round/sqrt/log/exp(x)` | num | scalar | num |
| `min/max(a, b)` | num, num | scalar | num |
| `goal_points(pos)` | str | position | num |
| `cs_points(pos)` | str | position | num |
| `assist_points` | — | constant | 3 |
| `rank(e [, g])` | expr, field? | cross-sectional | 0–1 |
| `zscore(e [, g])` / `z(...)` | expr, field? | cross-sectional | num |
| `quantile(e [, g])` | expr, field? | cross-sectional | 0–1 |
| `scale(e [, g])` | expr, field? | cross-sectional | 0–1 |
| `demean(e [, g])` | expr, field? | cross-sectional | num |
| `ts_mean(s, n)` | series, int | time-series | num |
| `ts_delta(s, n)` | series, int | time-series | num |
| `ts_sum(s, n)` | series, int | time-series | num |
| `ts_std(s, n)` | series, int | time-series | num |
| `ts_max(s, n)` | series, int | time-series | num |
| `ts_min(s, n)` | series, int | time-series | num |
