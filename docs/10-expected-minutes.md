# Expected Minutes & GW Point Projections

`expected_minutes(n)` and `xgw_pts(n)` are **parameterized built-in factors** — the only
factors in the DSL that take an integer argument specifying a GW window. They are the bridge
between season-long rate stats and actionable GW-specific decisions.

---

## The core idea

Every rate stat (`ga_per_90`, `xg90`, `pts_per_90`) is only meaningful when multiplied by
how many minutes a player will actually accumulate. The window `n` makes the planning
horizon explicit:

```
captain_score    = z(xgw_pts(1))                     # this GW only
transfer_3gw     = z(xgw_pts(3)) + z(value)          # short-term transfer planning
squad_build      = z(xgw_pts(6)) + z(consistency)    # medium-run squad structure
chip_window      = rank(xgw_pts(2), position)         # find the double-GW spikes
```

The argument `n` is always a **static integer** (known at parse time, not a runtime
expression). The engine computes one column per distinct `n` value used across all
factor definitions.

---

## Syntax

```
expected_minutes(n)    # total expected minutes over the next n GWs
xgw_pts(n)             # total expected FPL points over the next n GWs
```

Both are **built-in parameterized factors**, not user-definable. They compose with all
other factors and functions:

```
# Valid compositions
xgw_value(3)       = xgw_pts(3) / price                       # factor composed from parameterized factor
captain_3gw        = z(xgw_pts(3)) + z(consistency)
diff_pick_5gw      = z(xgw_pts(5)) - z(selected_by_percent)
chip_rank          = rank(xgw_pts(2), position)                # double-GW chip ranking
risk_adj(1)        = xgw_pts(1) * available                    # availability-adjusted this GW
```

> **Note:** User-defined factors that reference `xgw_pts(n)` or `expected_minutes(n)` are
> valid. The `n` is fixed in the expression — you cannot write `xgw_pts(my_window)` where
> `my_window` is another factor.

---

## `expected_minutes(n)` — the model

### What it computes

Total expected minutes a player will accumulate over the **next n GWs** from the current GW.

For each GW `k` in `[current, current + n)`:
1. Look up how many fixtures the player's team has in GW `k` (0 = blank, 1 = normal, 2 = double)
2. Multiply by the per-game minutes expectation
3. Sum across all `k`

```
expected_minutes(n) = Σ_k  fixtures_in_gw(k) × expected_minutes_per_game
```

Blank GWs contribute 0 automatically. Double GWs contribute up to 180 (two full games).
This makes the factor naturally fixture-aware without any special syntax.

### Per-game expectation

```
avg_minutes_pg    = minutes / games_played_proxy        # season average
minutes_trend_4   = ts_mean(series(minutes), 4)         # recent 4-GW trend

# Weighted blend: recent trend matters more than season average
expected_minutes_per_game = (0.6 × minutes_trend_4 + 0.4 × avg_minutes_pg) × available
```

The 60/40 blend weights the recent trend more heavily — it catches rotation changes,
injury returns, and formation shifts faster than the season average.

`available` (the injury probability factor) is a multiplier, not an addend: a 75% fitness
player is expected to play 75% of their normal minutes, not 0 or 90.

### The override — GW1 only

`expected_minutes(n)` for `n ≥ 1` uses:
- **GW1 (the current GW):** the user override if one is set, otherwise the model
- **GW2..n:** the model only (team news for future GWs is unknowable today)

This decay is the right default: you have good information about this week (team press
conferences, injury updates), but not about GW+3.

```
expected_minutes(1)  →  override₁  OR  model(GW1)
expected_minutes(3)  →  override₁  +   model(GW2) + model(GW3)
expected_minutes(6)  →  override₁  +   model(GW2..6)
```

As `n` grows, the override's contribution shrinks as a fraction of the total. By n=10,
a single GW override is ≤10% of the projection — the model dominates, as it should for
long-horizon planning.

---

## `xgw_pts(n)` — the point projection

### Formula

```
xgw_pts(n) = appearance_pts(n) + attack_pts(n) + cs_pts(n) + bonus_pts(n)
```

Each component scales with `expected_minutes(n)`.

### Appearance points

FPL awards 2pts for 60+ mins, 1pt for any minutes played.
Per GW with a fixture, approximate as:

```
# P(60+ mins) ≈ clamp(expected_minutes_per_game / 90, 0, 1) for simplicity
# More precise: iff(expected_minutes_per_game >= 60, 2, iff(expected_minutes_per_game > 0, 1, 0))
appearance_pts_per_gw = iff(expected_minutes_per_game >= 60, 2,
                           iff(expected_minutes_per_game > 0, 1, 0))
appearance_pts(n) = Σ_k  fixtures_in_gw(k) × appearance_pts_per_gw
```

### Attacking return points

Season-rate stats scaled by the fraction of a full game expected per GW:

```
ga_per_90          = per90(point_from_ga, minutes)
minutes_ratio      = clamp(expected_minutes_per_game / 90, 0, 1)
attack_pts_per_gw  = ga_per_90 × minutes_ratio

attack_pts(n)      = Σ_k  fixtures_in_gw(k) × attack_pts_per_gw
```

### Clean sheet points

CS only counts if the player plays 60+ minutes (FPL rule):

```
cs_rate            = clean_sheets / games_played_proxy    # season CS probability
cs_pts_per_gw      = cs_rate × cs_points(position) × iff(expected_minutes_per_game >= 60, 1, 0)

cs_pts(n)          = Σ_k  fixtures_in_gw(k) × cs_pts_per_gw
```

### Bonus points

BPS is earned for any minutes played, so scale freely:

```
bps_per_90         = per90(bps, minutes)
bonus_per_90       = per90(bonus, minutes)
bonus_pts(n)       = bonus_per_90 × expected_minutes(n) / 90
```

---

## The override panel — "GW Setup"

A dedicated UI panel — **GW Setup** — where you enter team-news knowledge before each
deadline. Separate from the factor editor; this is data entry, not computation.

```
┌──────────────────────────────────────────────────────┐
│  GW Setup                                   GW 32 ▾ │
├─────────────────────┬──────────────┬─────────────────┤
│  Player             │  Exp. mins   │  Note           │
├─────────────────────┼──────────────┼─────────────────┤
│  Salah              │   60  ●      │  "hamstring cap" │
│  Saka               │   45  ●      │  "EL Thu start"  │
│  Haaland            │   87  (auto) │                  │
│  Palmer             │   90  (auto) │                  │
│  Walker-Peters      │   90  ●      │  "Jesus injured" │
└─────────────────────┴──────────────┴─────────────────┘
         ● = manual override    (auto) = model value
```

- Computed values shown in muted style — you see what the model thinks
- Manual overrides shown distinctly — you see where you've applied judgment
- **Reset** clears the override and reverts to model
- **Note** field records why you overrode (shown in hover tooltip on the player)
- Overrides are **GW-scoped** — automatically cleared after the GW passes

### Override storage

```ts
{
  gw: number,
  overrides: {
    [playerId: number]: {
      expected_minutes?: number,   // manual value
      note?: string,
    }
  }
}
```

---

## Practical factor families

### GW-specific planning (n = 1)

```
xgw_pts_1    = xgw_pts(1)                         # this GW expected pts
xgw_value_1  = xgw_pts(1) / price                 # GW value: pts per £m this week
xgw_rank_1   = rank(xgw_pts(1), position)          # who to captain or play
captain_now  = z(xgw_pts(1)) + z(consistency)      # captain signal this GW
```

### Short-run transfer planning (n = 3–5)

```
xgw_pts_3    = xgw_pts(3)
xgw_pts_5    = xgw_pts(5)
xgw_value_5  = xgw_pts(5) / price                  # worth bringing in for the next 5?
transfer_ev  = z(xgw_pts(3)) + z(value)             # 3-GW transfer target
```

### Double GW chip deployment (n = 2)

```
dgw_rank     = rank(xgw_pts(2), position)           # who scores most across a DGW
dgw_diff     = iff(selected_by_percent < 15, xgw_pts(2), 0)   # DGW differentials
bb_score     = xgw_pts(2)                           # Bench Boost: maximise this
```

`xgw_pts(2)` naturally returns ~2× normal for DGW players and ~1× for SGW players because
the fixture count doubles. No special DGW flag needed.

### Long-run squad building (n = 6–10)

```
xgw_pts_8    = xgw_pts(8)
squad_build  = z(xgw_pts(8)) + z(consistency) + z(value)    # long-run squad quality
fixture_run  = rank(xgw_pts(6), position)           # best fixture run over 6 GWs
```

At n=6+, individual GW overrides are diluted — the model takes over and fixture swing and
rotation patterns dominate. This is the right behavior for long-horizon planning.

### Differential captain (any window)

```
captain_diff_1 = z(xgw_pts(1)) - z(selected_by_percent)    # low-owned captain this GW
captain_diff_3 = z(xgw_pts(3)) - z(selected_by_percent)    # low-owned over 3 GWs
```

---

## Example: comparing two captain options

User overrides: Salah → 60 mins (hamstring), Saka → 45 mins (Europa League rotation).

```
# With default expected_minutes model:
# Salah: 87 mins expected → xgw_pts(1) ≈ 6.8
# Saka:  82 mins expected → xgw_pts(1) ≈ 5.9

# With GW Setup overrides applied:
# Salah: 60 mins expected → xgw_pts(1) ≈ 4.9  (1pt appearance, 60% of attacking rate, no CS)
# Saka:  45 mins expected → xgw_pts(1) ≈ 3.2  (1pt appearance, 50% of attacking rate, no CS)
```

The override changes the captain decision. This is exactly the information edge the GW Setup
panel is designed to capture.

---

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Syntax | `xgw_pts(n)` — static integer arg | Explicit per expression; LLM-generatable; engine pre-computes per distinct `n` |
| Override scope | GW1 only; model for GW2..n | You have team-news knowledge this week, not next month |
| Override expiry | Auto-clear after GW passes | Stale overrides would corrupt future projections |
| Blank/DGW handling | Fixture count × per-game minutes | Falls out naturally from the fixture data; no special flag |
| CS model | Season cs_rate × ≥60-min threshold | Approximate but sufficient; GW-specific CS probability needs a richer model (future) |
| `n` constraint | Static integer, not an expression | Required for engine pre-computation; avoids runtime ambiguity |

---

## Open questions

1. **Generic override?** Should the override mechanism be limited to `expected_minutes`,
   or should *any* factor be overrideable per-player (e.g., `expected_cs`, `expected_bonus`)?
   Starting with `expected_minutes` only keeps the GW Setup panel focused.

2. **CS probability model:** The current `cs_rate = clean_sheets / games_played_proxy` is
   a naive season average. A fixture-specific model (`cs_rate × f(opponent_strength)`) would
   be more accurate for n=1. This requires reading the opponent from the `fixtures` source —
   feasible but adds complexity.

3. **`n` upper bound:** Should the engine cap `n`? At n=38 (full season) the projection
   is essentially `total_points` with a fixture-aware scaling. Probably fine to leave uncapped
   but document that n > 10 is dominated by the model and overrides are irrelevant.
