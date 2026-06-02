# Types

The factor DSL has a small, practical type system. The goal is to be permissive enough that
users never think about types — but precise enough to catch mistakes in the editor and give
the engine correct behavior.

---

## Primitive types

### `number`

All arithmetic, most base fields, all computed values. IEEE 754 double.

- Integers and floats are the same type: `6`, `3.14`, `1e3`.
- `null` is the "missing number" sentinel (see [Null handling](#null-handling) below).
- Computed values are rounded to **6 decimal places** at the factor boundary (display may
  round further; the stored value keeps full precision).
- `Infinity` and `NaN` are treated as `null` — never surfaced to the user.

### `string`

Position codes and status codes from the FPL API.

- `"GKP"`, `"DEF"`, `"MID"`, `"FWD"` — the position enum (see below).
- `"a"` (available), `"d"` (doubtful), `"i"` (injured), `"u"` (unavailable), `"s"` (suspended) — status codes.
- String literals use double quotes: `position == "FWD"`.
- Strings cannot participate in arithmetic; attempting `price + team` is an error.

### `bool`

There is no distinct boolean type at runtime. The DSL uses the **number-as-bool** convention:

- `1` is truthy, `0` is falsy.
- Comparison and logical operators always produce `1` or `0`.
- `iff(cond, t, f)` treats any non-zero, non-null number as truthy.

**Important:** Raw FPL boolean fields (`is_current`, `finished`, etc.) arrive as JavaScript
`true`/`false`. The engine **coerces them to `1`/`0`** before evaluation so they work in
expressions. Today's engine silently drops boolean fields from scope — this is the bug we fix.

### `series`

A per-player ordered array of historical gameweek values. Not a standalone expression type —
`series(field)` can only appear as the first argument to a time-series function:

```
ts_mean(series(points), 5)   ✓
series(points) + 1            ✗  (error — series is not a scalar)
```

`series(field)` references the `field` name in the per-GW history attached to each player row
as `row.__history`. If history is absent or has fewer entries than `n`, the function computes
over however many GWs are available (no error; see function docs for edge case behavior).

---

## The position enum

`position` is a string (`"GKP"`, `"DEF"`, `"MID"`, `"FWD"`) derived from the FPL
`element_type` field (1–4). The position-helper functions encode FPL scoring by position:

| Function call | GKP | DEF | MID | FWD |
|---|---|---|---|---|
| `goal_points(position)` | 6 | 6 | 5 | 4 |
| `cs_points(position)` | 4 | 4 | 1 | 0 |
| `assist_points` | 3 | 3 | 3 | 3 |

`assist_points` is a constant (always 3) exposed as a name for readability, not a function.

---

## Null handling

### Sources of null

- A numeric field is `null` when the FPL API sends it as `null`, empty string, or when it
  parses as `NaN`.
- A factor computation that produces `Infinity`, `NaN`, or divides by zero → `null`.
- `isnull(x)` returns `1` if `x` is null, `0` otherwise.
- `notnull(x)` is the inverse.

### Propagation rules

- Arithmetic with a `null` operand → `null` (null propagates).
- `coalesce(a, b)` → returns `a` if not null, else `b`. Use to substitute a default:
  ```
  available = coalesce(chance_of_playing_next_round, 100) / 100
  ```
- `iff(cond, t, f)` → if `cond` is null, returns `f` (treats null as falsy).
- Cross-sectional ops (`rank`, `z`, …) skip null values when building the distribution;
  a null input produces a null output.
- Time-series ops skip null entries in the history array.

### Display

Null values display as `—` in the player table and result table. They sort to the **bottom**
regardless of sort direction.

---

## Coercion summary

| From | To number | To bool (in iff/and/or) |
|---|---|---|
| `number` | identity | non-zero = truthy |
| `bool` (raw JS) | `true` → `1`, `false` → `0` | identity |
| `string` | error (can't do arithmetic on strings) | non-empty = truthy |
| `null` | stays null (propagates) | null = falsy |

---

## Type errors

Type errors are **lint diagnostics** (shown in the editor as squiggly underlines + gutter
markers) rather than runtime exceptions. The linter infers types from the field catalog and
factor definitions. Errors it can detect:

- Arithmetic on a known-string field: `total_points + team`
- Using a `series()` outside a ts-function
- Passing a number where a field-name group arg is expected: `rank(value, 3.14)`
- Unknown field or factor name in an expression

Type errors that require runtime information (e.g. a computed factor could be null due to
data) are surfaced as warnings, not errors.
