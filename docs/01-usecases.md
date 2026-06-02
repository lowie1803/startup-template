# Use Cases — Factor Catalog

The factor families an FPL manager actually needs. For each family: the factor definitions
you write in the editor, and how to inspect them using the right-panel controls.

**How to read this doc:**
The code blocks are what you type in the editor — pure computation definitions.
Filtering, sorting, and column selection happen in the right panel as UI controls and can be
saved as named views. There is no `filter:` or `show:` syntax in the editor.

Tier legend: **0** per-row scalar · **1** position-aware / composition · **2** cross-sectional
(whole column) · **3** time-series (per-GW history)

---

## 1. Value hunting

Who gives the most output per pound spent?

```
value         = total_points / price
form_value    = form / price
ppg90         = per90(total_points, minutes)
ict_per_price = ict_index / price
```

Position-relative ranking — the one that actually drives decisions:

```
value_rank_pos  = rank(value, position)
form_value_rank = rank(form_value, position)
ppg90_rank      = rank(ppg90, position)
```

`value_rank_pos = 0.95` means top 5% for value within their position.
Comparing a £12m striker to a £4.5m defender on raw `value` is meaningless — ranking within
position is what matters.

Fixture-adjusted value weighs current value by upcoming ease:

```
value_adj = value * fixture_ease / 3
```

Budget picks only (premium players zeroed out):

```
budget_pick  = iff(price < 6.0, value_rank_pos, 0)
nailed_value = iff(minutes > 1500, value, 0)    # ignore rotation-risk players
```

**To inspect:** sort by `value_rank_pos` descending; filter to one position; show `name`,
`team`, `price`, `total_points`, `value`, `value_rank_pos`.

---

## 2. Form & momentum

Who is hot right now — and is the heat sustainable?

FPL's native `form` is the baseline. We add our own rolling windows and directional signals:

```
form_ts = ts_mean(series(points), 5)    # same 5-GW window, but we control it
form_3  = ts_mean(series(points), 3)    # shorter — current heat, ignores a stale bad GW
```

Momentum (direction matters as much as level):

```
momentum   = ts_delta(series(points), 3)    # pts gained/lost vs 3 GWs ago — +ve = improving
momentum_s = ts_delta(series(points), 2)    # shorter, more reactive, noisier
```

`momentum > 0` = improving. `momentum < -4` = fading fast — classic sell trigger even if
`form` still looks okay, because form averages in the earlier good weeks.

Consistency (reliable vs boom-bust):

```
consistency = 1 / (ts_std(series(points), 6) + 1)
```

High value = low variance. Averaging 5pts every GW beats alternating 10 and 0 for both
captaincy and planning. The `+ 1` prevents division by zero.

Spike detector — currently hot above own long-run baseline:

```
hot = z(form) - z(ts_mean(series(points), 10))
```

Both z-scored so scales match. Positive = current form is above the player's own historical
average relative to the rest of the league — not just "in form" but "surprisingly in form."

Composite signals:

```
rising_star     = z(form) + z(momentum)          # in form AND improving
reliable_scorer = z(form) + z(consistency)        # in form AND consistent
momentum_rank   = rank(rising_star, position)
```

**To inspect:** sort by `momentum` or `rising_star` descending; filter `minutes > 500`;
show `name`, `team`, `position`, `form`, `momentum`, `consistency`.

> **Data note:** `series(points)` is available now (last 5 GWs). Longer windows and
> `series(minutes)`, `series(price)` etc. need the per-GW snapshot (backlog 109/064).

---

## 3. Expected stats — over/under-performance

Expected goals models reveal luck and regression-to-mean edges.

```
xg_over = goals_scored - expected_goals     # finishing luck: +ve = overperforming (likely to regress)
xa_over = assists - expected_assists        # creation luck
xgi     = expected_goal_involvements        # combined underlying threat (base field)
```

Per-90 rates strip out the minutes-played distortion:

```
xg90  = per90(expected_goals, minutes)
xa90  = per90(expected_assists, minutes)
xgi90 = per90(expected_goal_involvements, minutes)
g90   = per90(goals_scored, minutes)
a90   = per90(assists, minutes)
```

`xg_over > 2` on a striker strongly suggests overconversion — sell before the goals dry up.
`xg_over < -2` with high `xg90` = unlucky finisher with real underlying threat — buy signal.

Expected attacking points model:

```
xpts_attack = expected_goals * goal_points(position) + expected_assists * assist_points
attack_over = point_from_ga - xpts_attack    # outperforming model = +ve (sell), underperforming = -ve (buy)
```

Regression signals ranked:

```
regression_sell = rank(xg_over, position)      # overperformers to sell
regression_buy  = rank(-xg_over, position)     # underperformers likely to bounce back
unlucky_quality = iff(xg90 > 0.2 and xg_over < -1, 1, 0)    # prime buy flag
```

Expected CS floor for defenders:

```
xcs_proxy = iff(fdr_def < 7, cs_points(position), 0)    # rough binary CS likelihood
```

**To inspect:** sort by `xg_over` descending (overperformers) or ascending (underlucky);
filter `position == "FWD"` and `minutes > 600`; show `name`, `team`, `goals_scored`,
`expected_goals`, `xg_over`, `g90`, `xg90`.

---

## 4. Point attribution

Decompose `total_points` to understand *why* a player scores well.

Building blocks — the base of the composition chain:

```
point_from_goals   = goals_scored * goal_points(position)
point_from_assists = assists * assist_points
point_from_cs      = clean_sheets * cs_points(position)
point_from_ga      = point_from_goals + point_from_assists    # your original example
point_from_bonus   = bonus
```

Structural analysis:

```
structural_floor = point_from_cs + point_from_bonus    # returns regardless of attacking output
ceiling          = point_from_ga                        # requires goals/assists
attack_share     = point_from_ga / total_points         # fragile if > 0.7 for a DEF
defensive_share  = point_from_cs / total_points
```

`attack_share > 0.7` for a defender is a red flag: if the attacking returns dry up,
so does their FPL value. `attack_share < 0.3` for a striker means they barely score.

Source-of-return breakdown:

```
goal_heavy   = iff(point_from_goals > point_from_assists * 2, 1, 0)
assist_heavy = iff(point_from_assists > point_from_goals * 2, 1, 0)
dual_threat  = iff(goals_scored > 3 and assists > 3, 1, 0)
```

Bonus efficiency:

```
bonus_share      = point_from_bonus / total_points      # how bonus-dependent are their returns?
bps_conversion   = iff(bps > 0, bonus / (bps / 100), 0)
```

`bonus_share > 0.15` is a structural positive — BPS is persistent. Over-reliance on goals
alone (`attack_share` high, `bonus_share` low) is more fragile.

GK-specific attribution:

```
point_from_saves = saves / 3
gk_total_attr    = point_from_saves + point_from_cs + point_from_bonus
gk_save_reliance = point_from_saves / total_points
```

**To inspect:** sort by `attack_share` descending to find fragile goal-dependent players;
or sort by `structural_floor` to find reliable floor players; filter by position.

---

## 5. Fixtures & captaincy

Who is best placed to score this gameweek?

Fixture factors (more precise than the composite `fdr`):

```
fixture_ease     = 6 - fdr           # invert: higher = easier
fixture_ease_att = 6 - fdr_att       # attacking fixture ease
fixture_ease_def = 6 - fdr_def       # defensive fixture ease (CS probability)
```

Captain signals — from simple to composite:

```
# Pure form captain (ignores fixtures — useful when FDR is noisy)
captain_form = z(form) + z(ppg90)

# Standard multi-signal composite
captain = z(form) + z(fixture_ease) + z(xg_over)

# Fixture-heavy (when this GW's fixture is unusually easy/hard)
captain_fixture_heavy = z(form) + 2 * z(fixture_ease) + z(xg_over)

# Defensive captain (GKs and DEFs — CS probability matters)
captain_def = z(form) + z(fixture_ease_def) + z(point_from_cs)

# Full model — five orthogonal signals
captain_full = z(form) + z(fixture_ease_att) + z(xg_over) + z(ppg90) + z(momentum)
```

Position-relative captain ranking:

```
captain_rank_pos = rank(captain, position)
```

`captain_rank_pos > 0.95` among MIDs = top 5% captaincy option at that position. Compare
the top-1 MID vs top-1 FWD for the armband.

Supporting factors:

```
fixture_xpts     = xpts_attack * fixture_ease / 3    # GW-specific expected return
fixture_xpts_adj = fixture_xpts * available
double_threat    = iff(form > 7 and fixture_ease > 3, 1, 0)    # pre-filter flag
```

**To inspect:** sort by `captain_rank_pos` descending; filter `minutes > 900`,
`available > 0.75`, `position != "GKP"`; show `name`, `team`, `position`, `form`,
`fixture_ease`, `xg_over`, `captain_rank_pos`.

---

## 6. Differentials & template awareness

Finding the edge — good players the field isn't on.

Ownership segmentation:

```
template_risk = iff(selected_by_percent > 30, 1, 0)    # must-have — high risk to be without
popular       = iff(selected_by_percent > 15, 1, 0)
differential  = iff(selected_by_percent < 10, 1, 0)    # low-owned
pure_diff     = iff(selected_by_percent < 5,  1, 0)    # rare differential
```

Differential quality:

```
# Good form × low ownership = edge when the player hauls
diff_score = rank(form) * (1 - selected_by_percent / 100)

# Z-score version: output upside vs the field not having them
eo_edge    = z(fixture_xpts) - z(selected_by_percent)

# Full composite: form + fixtures - ownership
differential_full = z(form) + z(fixture_ease) - z(selected_by_percent)
```

`eo_edge` (effective ownership edge): positive = better expected output than ownership
suggests. The higher this is, the more you gain when they haul and rivals don't.

Breakout candidate — rising fast, still low-owned:

```
breakout       = iff(selected_by_percent < 15 and momentum > 3, 1, 0)
breakout_score = z(momentum) - z(selected_by_percent)    # buy before the price rises
```

**To inspect — differentials:** filter `selected_by_percent < 10`, `minutes > 600`,
`available > 0.8`; sort by `differential_full` descending; show `name`, `team`, `position`,
`price`, `selected_by_percent`, `form`, `fixture_ease`.

**To inspect — breakouts:** filter `breakout == 1`; sort by `breakout_score` descending.

---

## 7. Price & transfer pressure

Who is likely to rise or fall in price?

```
net_transfers = transfers_in_event - transfers_out_event    # demand this GW (positive = inflow)
```

Pressure rankings:

```
rise_pressure = rank(net_transfers)     # 1.0 = highest inflow → likely to rise
fall_pressure = rank(-net_transfers)    # 1.0 = most outflow → likely to fall
```

Price change history vs season start:

```
season_rise = cost_change_start / 10      # total £ movement since GW1 (positive = risen)
still_cheap = iff(season_rise < 0.1, 1, 0)    # hasn't risen yet despite form
```

Combine into action flags:

```
buy_before_rise = iff(rise_pressure > 0.85 and still_cheap == 1 and form > 5, 1, 0)
cut_before_fall = iff(fall_pressure > 0.85 and form < 3, 1, 0)
```

Sustained demand (requires per-GW snapshot):

```
price_momentum = ts_sum(series(net_transfers), 3)    # 3 consecutive weeks of inflow > single spike
```

**To inspect — risers:** filter `transfers_in_event > 50000`; sort by `net_transfers`
descending; show `name`, `team`, `position`, `price`, `season_rise`, `net_transfers`, `form`.

**To inspect — fallers:** filter `net_transfers < -100000`; sort ascending.

**To inspect — buy window:** filter `rise_pressure > 0.8`, `still_cheap == 1`; sort by
`rise_pressure` descending; show `name`, `team`, `position`, `price`, `season_rise`,
`net_transfers`, `form`.

> **Data note:** `series(net_transfers)` needs the per-GW snapshot. Single-GW values
> (`net_transfers`, `rise_pressure`, `fall_pressure`) are available now.

---

## 8. Availability & minutes risk

Are you getting the player you paid for?

```
available = coalesce(chance_of_playing_next_round, 100) / 100
```

`available = 1.0` = fully fit (null for healthy players, defaulted to 100%).
`available = 0.75` = 75% chance. `available = 0.0` = ruled out.

Starter security:

```
nailed         = iff(minutes > 1500, 1, 0)
starts_proxy   = iff(minutes > 1800, 1, iff(minutes > 900, 0.7, 0.3))
rotation_risk  = iff(available > 0.9 and minutes < 1200, 1, 0)    # available but not playing
```

Risk-adjusted returns:

```
risk_adj_xpts  = xpts_attack * available
risk_adj_value = value * available * nailed    # most conservative: requires fit AND nailed
```

Minutes trend (requires snapshot):

```
minutes_trend = ts_mean(series(minutes), 4)     # avg mins last 4 GWs
minutes_drop  = ts_delta(series(minutes), 3)    # negative = benching risk
```

`minutes_drop < -30` over 3 GWs = rotation red flag even with no injury flag.

```
starter_trust = z(available) + z(nailed) + z(form)
```

**To inspect — injury risk:** filter `available < 0.75`, `total_points > 60`; sort by
`available` ascending; show `name`, `team`, `position`, `price`, `available`, `minutes`, `form`.

**To inspect — rotation risk:** filter `rotation_risk == 1`, `price > 6.0`; sort by
`value` descending; show `name`, `team`, `position`, `price`, `minutes`, `risk_adj_value`.

---

## 9. Bonus / BPS engine

Bonus points are underrated — structurally persistent and independent of match outcome.

```
bps90     = per90(bps, minutes)
bonus_pg  = per90(bonus, minutes)
```

Ranking:

```
bonus_magnet     = rank(bps90, position)    # within position
bonus_magnet_all = rank(bps90)              # across everyone
```

A defensive midfielder with elite BPS earns 2–3 bonus most weeks even in goalless draws.
`bonus_magnet` finds them regardless of goals/assists output.

Reliability analysis:

```
bonus_share    = bonus / total_points              # how bonus-dependent are their returns?
bps_conversion = iff(bps > 0, bonus / (bps / 100), 0)    # BPS → bonus conversion rate
```

GK-specific:

```
point_from_saves = saves / 3
gk_save_floor    = point_from_saves + point_from_cs
gk_bonus_rate    = per90(bonus, minutes)
```

**To inspect — hidden bonus earners:** filter `minutes > 900`, `bps90 > 30`; sort by
`bonus_magnet` descending; show `name`, `team`, `position`, `price`, `bps`, `bps90`,
`bonus`, `bonus_share`.

---

## 10. Cross-sectional composites — "alpha stacks"

Combining multiple z-scored signals into a single ranking. The core power of the factor DSL.

Transfer-in composite — four orthogonal signals:

```
transfer_target = z(form) + z(fixture_ease) + z(value) + z(available)
transfer_target_rank = rank(transfer_target, position)
```

`transfer_target_rank = 0.98` among DEFs = second-best defensive transfer in the game.
The position-relative rank is what you act on.

Sell composite:

```
sell_signal = z(-form) + z(fall_pressure) + z(attack_over)
```

Bad form + being sold by everyone + overperforming underlying numbers = get out now.

Captain composite (full model):

```
captain_full = z(form) + z(fixture_ease_att) + z(xg_over) + z(ppg90) + z(momentum)
```

Five orthogonal signals. Each adds an independent piece of information; the composite is
more stable than any individual signal.

Differential composite:

```
diff_target = z(form) + z(fixture_ease) - z(selected_by_percent)
```

Subtracting ownership z-score gives credit for being unpopular at the same expected output.

Budget enabler composite:

```
budget_score = iff(price < 5.5, z(value) + z(consistency) + z(nailed), 0)
budget_rank  = rank(budget_score)
```

Fixture-run composite (multi-week planning):

```
fixture_run_score = z(-fdr) + z(-fdr_att)
squad_plan_rank   = rank(fixture_run_score, position)
```

**To inspect — transfer targets:** filter `available > 0.75`, `minutes > 600`; sort by
`transfer_target_rank` descending; show `name`, `team`, `position`, `price`, `form`,
`fixture_ease`, `value`, `transfer_target_rank`.

**To inspect — sell candidates:** filter `minutes > 500`; sort by `sell_signal` descending;
show `name`, `team`, `position`, `price`, `form`, `net_transfers`, `attack_over`.

---

## 11. Position-specific factors

Factors gated on position so they work in mixed-position views without polluting other groups.

### Goalkeepers

```
gk_floor       = point_from_saves + point_from_cs
gk_value       = iff(position == "GKP", gk_floor / price, 0)
gk_save_rate   = iff(position == "GKP", per90(saves, minutes), 0)
gk_cs_bonus    = iff(position == "GKP", clean_sheets * 5, 0)    # 4pts CS + avg 1pt bonus
gk_captain     = iff(position == "GKP", captain_def, 0)
gk_rank        = rank(gk_value, position)
```

### Defenders

```
# Attacking defender signal — premium full-back
def_attacking        = iff(position == "DEF", point_from_ga, 0)
def_attacking_rank   = rank(def_attacking, position)

# Defensive value — CS + bonus
def_floor_value      = iff(position == "DEF", (point_from_cs + bonus) / price, 0)

# Budget enabler: nailed, cheap, CS-strong
def_enabler          = iff(position == "DEF" and price < 5.5, value, 0)
def_premium_signal   = iff(position == "DEF" and def_attacking > 20, 1, 0)

# Complete defender: both floor (CS) and ceiling (attacking)
def_complete         = iff(position == "DEF", point_from_cs + point_from_ga, 0)
def_complete_rank    = rank(def_complete, position)
```

### Midfielders

```
mid_goal_threat    = iff(position == "MID", point_from_goals / total_points, 0)
mid_creativity     = iff(position == "MID", point_from_assists, 0)

# All-round: goals + assists + CS (holding mids with structure)
mid_all_round      = iff(position == "MID", point_from_ga + point_from_cs, 0)

# Premium mid signal
mid_premium        = iff(position == "MID" and total_points > 100 and xg_over > 1, 1, 0)

# Budget: sub-£6.5m with strong underlying stats
mid_budget_quality = iff(position == "MID" and price < 6.5, xgi90, 0)
mid_budget_rank    = rank(mid_budget_quality, position)
```

### Forwards

```
fwd_goal_ratio   = iff(position == "FWD", point_from_goals / total_points, 0)
fwd_xg_rate      = iff(position == "FWD", per90(expected_goals, minutes), 0)
fwd_involvement  = iff(position == "FWD", point_from_ga + bonus, 0)

# Budget FWD: £6m and under with real output
fwd_budget_picks = iff(position == "FWD" and price < 6.5, value, 0)

# Premium FWD worth the price
fwd_premium      = iff(position == "FWD" and price > 9.0, value, 0)
fwd_premium_rank = rank(fwd_premium, position)
```

**To inspect — complete defenders:** filter `position == "DEF"`, `minutes > 1000`; sort
by `def_complete_rank` descending; show `name`, `team`, `price`, `def_attacking`,
`point_from_cs`, `def_complete`.

**To inspect — budget mids:** filter `position == "MID"`, `price < 6.5`, `minutes > 700`;
sort by `mid_budget_rank` descending; show `name`, `team`, `price`, `xgi90`, `total_points`.

---

## 12. Defensive contribution — DefCon (2025-26)

The 2025-26 rule awards **2 pts** when a player clears a per-match defensive action threshold.
All fields below are **confirmed present** on the live FPL API element.

```
defcon_rate  = defensive_contribution_per_90    # base field — DefCon pts per 90 (API provides)
defcon_total = defensive_contribution           # season total
defcon_value = defensive_contribution / price   # DefCon pts per £m — the edge metric
cbi90        = per90(clearances_blocks_interceptions, minutes)
tackle90     = per90(tackles, minutes)
recovery90   = per90(recoveries, minutes)
```

Rankings and composites:

```
defcon_rank_pos = rank(defensive_contribution_per_90, position)

# High-floor defender: top DefCon rate AND good CS record
defcon_floor    = z(defcon_rate) + z(point_from_cs)

# Budget defender with elite DefCon rate — hidden gem
defcon_budget   = iff(price < 5.0, defcon_value, 0)
defcon_budget_rank = rank(defcon_budget)

# Complete defender: CS + DefCon + attacking
complete_def    = z(point_from_cs) + z(defcon_rate) + z(def_attacking)
```

Holding mid DefCon (MIDs need ≥12 actions including recoveries):

```
holding_mid      = iff(position == "MID", z(defcon_rate) + z(cbi90) + z(recovery90), 0)
holding_mid_rank = rank(holding_mid, position)
```

**To inspect — budget DefCon picks:** filter `position == "DEF"`, `price < 5.5`,
`minutes > 700`; sort by `defcon_value` descending; show `name`, `team`, `price`,
`defcon_total`, `defcon_rate`, `defcon_value`, `clean_sheets`.

**To inspect — holding mids:** filter `position == "MID"`, `minutes > 900`; sort by
`defcon_rate` descending; show `name`, `team`, `price`, `defcon_rate`, `cbi90`, `recovery90`.

---

## 13. Composition chains — putting it all together

Real usage is a chain: foundational factors feed composites; composites drive the view you
sort by. The right panel's sort + filter + column selection is where you act on the output.

### Captain decision this GW

```
# Ingredients (in base pack, already defined)
fixture_ease = 6 - fdr
xpts_attack  = expected_goals * goal_points(position) + expected_assists * assist_points
xg_over      = goals_scored - expected_goals

# Signal
captain      = z(form) + z(fixture_ease) + z(xg_over)

# Ranked within position
captain_rank_pos = rank(captain, position)
```

→ **View config:** filter `position != "GKP"`, `minutes > 1000`, `available > 0.9`;
sort by `captain_rank_pos` descending; show `name`, `team`, `position`, `price`, `form`,
`fixture_ease`, `xg_over`, `captain_rank_pos`. Save as view **"Captain picks"**.

### Best transfer-in for your midfield slot under £7.5m

```
value           = total_points / price
ppg90           = per90(total_points, minutes)
fixture_ease    = 6 - fdr
xg_over         = goals_scored - expected_goals
available       = coalesce(chance_of_playing_next_round, 100) / 100

transfer_target      = z(form) + z(fixture_ease) + z(value) + z(available)
transfer_target_rank = rank(transfer_target, position)
```

→ **View config:** filter `position == "MID"`, `price < 7.5`, `minutes > 700`,
`available > 0.75`; sort by `transfer_target_rank` descending. Save as view
**"MID transfer targets <7.5"**.

### Differential that makes your rank surge

```
form_value         = form / price
differential_score = z(form) + z(fixture_ease) - z(selected_by_percent)
diff_rank          = rank(differential_score, position)
```

→ **View config:** filter `selected_by_percent < 10`, `minutes > 600`, `available > 0.8`;
sort by `diff_rank` descending; show `name`, `team`, `position`, `price`,
`selected_by_percent`, `form`, `fixture_ease`, `diff_rank`. Save as **"Differentials"**.

### Sell signal — who in your squad should go?

```
xg_over       = goals_scored - expected_goals
net_transfers = transfers_in_event - transfers_out_event
fall_pressure = rank(-net_transfers)
sell_signal   = z(-form) + z(fall_pressure) + z(xg_over)
```

→ **View config:** filter `form < 4` or `fall_pressure > 0.8`; sort by `sell_signal`
descending; show `name`, `team`, `position`, `price`, `form`, `net_transfers`,
`xg_over`, `sell_signal`. Save as **"Sell candidates"**.

---

## 14. Expected minutes & GW point projections

The most actionable factor family: expected FPL points over a specific GW window.
Unlike season-total factors, these are answers to the question you're actually asking
right now — "who should I captain?", "is this worth a transfer?", "who do I start
in my Bench Boost week?"

The key parameter is `n`: the number of GWs to look ahead. Larger `n` means the model
dominates; smaller `n` (especially `n=1`) is where your manual override of `expected_minutes`
via the GW Setup panel makes the most difference.

### Core parameterized factors

```
# Expected minutes accumulated over the next n GWs
# n=1: uses your manual override if set; n>1: GW1 uses override, GW2..n use model
expected_minutes(1)    # this GW — team-news sensitive
expected_minutes(3)    # next 3 GWs — recent trend + fixture calendar
expected_minutes(6)    # medium run — model dominates, fixture swing matters

# Expected FPL points over the next n GWs
xgw_pts(1)    # this GW only
xgw_pts(3)    # 3-GW projection
xgw_pts(5)    # 5-GW projection
xgw_pts(8)    # long run
```

Blank GWs contribute 0 minutes automatically. Double GW players score ~2× because the
fixture count doubles — no special handling needed.

### GW-specific factors (n = 1)

```
xgw_value_1  = xgw_pts(1) / price              # GW value: pts per £m this week
xgw_rank_1   = rank(xgw_pts(1), position)      # who to captain or start this GW
captain_now  = z(xgw_pts(1)) + z(consistency)  # this-GW captain signal (rate × mins + reliability)
```

**Inspect with:** sort by `xgw_rank_1` descending; filter `available > 0.75`.
Save as view **"GW captain"**.

### Short-run transfer planning (n = 3–5)

```
xgw_pts_3    = xgw_pts(3)
xgw_value_3  = xgw_pts(3) / price
transfer_ev  = z(xgw_pts(3)) + z(value)          # is it worth the transfer hit?
diff_3gw     = z(xgw_pts(3)) - z(selected_by_percent)  # differential for the next 3
```

**Inspect with:** sort by `transfer_ev` descending; filter `position == "MID"`,
`price < 8.0`, `available > 0.8`. Save as **"Transfer targets 3GW"**.

### Double GW chip deployment (n = 2)

`xgw_pts(2)` is the natural chip week factor. Players with two fixtures this GW
automatically return ~2× expected points; players with blanks return 0. No flag needed.

```
dgw_rank     = rank(xgw_pts(2), position)                  # DGW ranking within position
dgw_value    = xgw_pts(2) / price                          # DGW value per £m
bb_score     = xgw_pts(2)                                   # Bench Boost: maximise this
chip_diff    = iff(selected_by_percent < 15, xgw_pts(2), 0) # DGW differentials
wc_target    = z(xgw_pts(5)) + z(value) + z(consistency)   # WC squad rebuild: who to bring in
```

**Inspect with:** sort by `dgw_rank` descending; filter `available > 0.9`. Save as
**"DGW chip targets"**.

### Long-run squad building (n = 6–10)

At large `n`, individual GW news is irrelevant — fixture swing, rotation patterns, and
consistency dominate.

```
squad_build  = z(xgw_pts(8)) + z(consistency) + z(value)   # long-run squad quality
fixture_run  = rank(xgw_pts(6), position)                   # best next-6-GW fixture run
sell_long    = iff(xgw_pts(8) < xgw_pts_threshold, 1, 0)   # underperforms over 8 GWs → sell
```

**Inspect with:** sort by `squad_build` descending; filter `minutes > 900`,
`available > 0.85`. Save as **"Long-run squad"**.

### Composing with other factor families

`xgw_pts(n)` composes freely with everything else:

```
# Captain who is also a differential
captain_diff_1 = z(xgw_pts(1)) - z(selected_by_percent)

# Risk-adjusted GW value (fold in injury uncertainty on top of the minutes model)
risk_adj_1     = xgw_pts(1) * available

# Value among nailed starters only, 3-GW view
nailed_value_3 = iff(nailed == 1, xgw_pts(3) / price, 0)

# Compare premium vs budget: is the expensive player worth the price delta over 5 GWs?
cost_efficiency_5 = xgw_pts(5) / price
```

### The GW Setup override

`expected_minutes(1)` uses your manually set value if you've entered one in the GW Setup
panel. This is where team-news knowledge enters the system:

- Salah on 60-min cap after hamstring: set `expected_minutes = 60`
- Saka rested after Europa League: set `expected_minutes = 45`
- Haaland fully fit: leave as auto (`≈87` from the model)

After the GW passes, overrides clear automatically. The result: `xgw_pts(1)` reflects what
you actually know, not just what the model guesses.

See [`10-expected-minutes.md`](10-expected-minutes.md) for the full model and override design.

---

---

## 15. Set-piece takers

The FPL element has three numeric ordering fields per player — `penalties_order`,
`corners_and_indirect_freekicks_order`, `direct_freekicks_order`. `1` = first choice,
`2` = backup, `null` = not a taker. 132 players have at least one field set.

### What the order field tells you (and what it doesn't)

**It tells you:** theoretical priority — who steps up if the first-choice taker is on the
pitch and fit. Reliable for penalties (one taker at a time). Less meaningful for corners.

**It doesn't tell you:**
1. **Volume** — how many corners/FKs that player actually delivers. AVL lists 6 corner
   takers; ARS lists 4. Most teams have a left-side taker and a right-side taker, and
   the order field gives you no way to know which side each player covers. A player listed
   as order 1 might only take right-side corners; order 2 might own the left.
2. **Left vs right split** — genuinely unknowable from FPL data alone. The `set_piece_notes`
   endpoint might contain this detail but is only accessible via the server proxy (not
   directly from the client). No factor can resolve this from the element fields.

### Volume proxy via `creativity_per_start`

The best available approximation for actual set-piece delivery rate:

```
creativity_per_start = iff(starts > 0, creativity / starts, 0)
```

FPL awards creativity points for every cross, chance created, and set piece delivered.
A player consistently taking corners will accumulate creativity even without assists.

Real values from live data: B.Fernandes (MUN) 55.4, Rice (ARS) 29.4, Saka (ARS) 33.9,
Szoboszlai (LIV) 36.8. These track closely with who's actually standing over balls.
A player listed as order 3 with `creativity_per_start < 15` is rarely delivering in practice.

### Practical set-piece factors

```
# Penalty role flags — reliable, one taker at a time
pen_taker       = iff(penalties_order == 1, 1, 0)
pen_backup      = iff(penalties_order == 2, 1, 0)

# Corner/FK: use order + creativity together — order alone is misleading
corner_listed   = iff(corners_and_indirect_freekicks_order > 0 and
                      corners_and_indirect_freekicks_order <= 2, 1, 0)

# Active deliverer: listed in top-2 AND demonstrably high delivery rate
active_corner_taker = iff(corner_listed == 1 and creativity_per_start > 20, 1, 0)

# Direct FK taker — more reliable than corners (usually one dedicated player)
direct_fk_taker = iff(direct_freekicks_order == 1, 1, 0)
```

`creativity_per_start > 20` is the empirical threshold that filters out players listed as
backups who rarely deliver. Players below it (order 3–6 fillers) contribute negligibly.

```
# Dead-ball premium: active corner AND penalty taker — double dead-ball value
set_piece_premium = iff(active_corner_taker == 1 and pen_taker == 1, 1, 0)

# Set-piece adjusted value for penalties — ~0.2–0.3 penalties per match adds ~3–5 pts/season
pen_adjusted_value = iff(pen_taker == 1, value * 1.12, value)

# Delivery volume score: combines order weight with creativity rate
corner_delivery_score = iff(corners_and_indirect_freekicks_order == 1,
                              creativity_per_start,
                         iff(corners_and_indirect_freekicks_order == 2,
                              creativity_per_start * 0.5, 0))
```

### What this can and cannot answer

| Question | Answer |
|---|---|
| "Is this player the first-choice penalty taker?" | ✓ `penalties_order == 1` — reliable |
| "Does this player take corners?" | ~ `active_corner_taker` — good approximation |
| "How many corners do they take per game?" | ~ `creativity_per_start` as a proxy — directionally correct |
| "Do they take left or right side corners?" | ✗ unknowable from FPL data |
| "Are they the dominant FK taker at their club?" | ~ `direct_freekicks_order == 1` + `creativity_per_start` |

**Root gap — preferred foot is not in the FPL API at all.** Preferred foot is the natural
signal for inferring corner side (right-footed → left-side corners, typically). The FPL
element has 105 fields; none relate to foot, handedness, or physical attributes. The
`opta_code` field exists on each element and could be used to join against an external
Opta dataset, but that requires a separate data source.

The practical path if corner-side accuracy matters: a **static lookup table** (`datasets/player-attributes.json`)
mapping player `id` → `{ preferred_foot: "left" | "right" }`, maintained once per season
from FBref or Transfermarkt. This would be a new source type — curated static data, not a
live API — and a concrete example of the dataset snapshot pattern from backlog 109.

**Inspect with:** filter `active_corner_taker == 1` or `pen_taker == 1`; sort by
`corner_delivery_score` or `pen_adjusted_value` descending; show `name`, `team`, `position`,
`price`, `penalties_order`, `corners_and_indirect_freekicks_order`, `creativity_per_start`.
Save as view **"Set-piece takers"**.

---

## 16. Out of scope for v1 (deferred)


| Question | Why deferred |
|---|---|
| "How often has this player made the GW dream team?" | Needs multi-GW `dream_team` data per player (backlog 109) |
| "How does this player perform at home vs away?" | Needs a fixture↔player join |
| `series(minutes)`, `series(price)` etc. | Need the per-GW snapshot (backlog 109/064) |
| "Best 6-GW fixture run" | `fdr` is next-3 only; multi-GW lookahead needs a fixture join + aggregation |

The **join primitive** is the single capability this design consciously defers. Remaining
deferred items reduce to "needs a join" or "needs more per-GW history data."

Note: set-piece takers were previously listed as deferred, but the FPL element object has
per-player numeric ordering fields directly — no join needed. See §15.
