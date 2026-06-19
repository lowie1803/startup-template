# fplang Field Dictionary

> **Generated** by `scripts/build-field-dictionary.ts` — do not edit directly.
> Regenerate with `npm run gen:dictionary`.

Combined field catalog for all player-level data sources available to fplang factor expressions.
Fields are the atoms: every factor is a formula over these names.

## Summary

| Source | Fields | Status |
|--------|--------|--------|
| `fpl` | 35 | ✅ live (implemented) |
| `football_data` (player scorer) | 8 | 🔷 proposed (ticket 028) |
| `football_data` (team standings) | 9 | 🔷 proposed (ticket 028) |
| `football_data` (transfer prior) | 5 | 🔷 proposed (ticket 028) |
| **Total** | **57** | |

**Status**: ✅ live = implemented and loaded from snapshot. 🔷 proposed = field catalog defined; source not yet implemented.

**Entity levels**:
- `player` — one value per FPL player, directly.
- `team → player` — one value per team (standings), broadcast to every player on that team.
- `prior → player` — previous-season value from SA/FL1, matched by name+DOB; 0 for no prior.

**Shots note**: football-data.org does not expose shot counts at any tier. Use `threat` + `expected_goals` (FPL) as a shot-volume proxy — see Opportunities §shot gap below.

---

## FPL fields (`fpl` source — 35 fields, live)

Access as bare names in factor expressions (e.g. `goals_scored`, `form`, `price`).
The `fpl.` prefix is also accepted but optional.

| Field | Source | Status | Type | Entity | Description |
|-------|--------|--------|------|--------|-------------|
| `id` | fpl | ✅ live | number | player | FPL element ID — unique integer per player across the season [1–9999] |
| `web_name` | fpl | ✅ live | string | player | Short display name as shown on the FPL website (e.g. "Salah") |
| `position` | fpl | ✅ live | string | player | Position: GKP, DEF, MID, or FWD (derived from element_type 1–4) |
| `team` | fpl | ✅ live | string | player | Team short name, e.g. "LIV", "ARS", "MCI" |
| `price` | fpl | ✅ live | number (£m) | player | Current price in £m (now_cost / 10) [3–20] |
| `selected_by_percent` | fpl | ✅ live | number (%) | player | Ownership as a percentage of all FPL managers [0–100] |
| `total_points` | fpl | ✅ live | number | player | Season total FPL points [0–400] |
| `form` | fpl | ✅ live | number | player | FPL rolling form score — average points over the last 4 gameweeks [0–20] |
| `bps` | fpl | ✅ live | number | player | Bonus point system total for the season [0–2000] |
| `bonus` | fpl | ✅ live | number | player | Total bonus points earned this season (1–3 per game) [0–200] |
| `ict_index` | fpl | ✅ live | number | player | ICT Index — composite of influence, creativity, and threat scores [0–500] |
| `minutes` | fpl | ✅ live | number (min) | player | Total minutes played this season [0–3780] |
| `chance_of_playing_next_round` | fpl | ✅ live | number (%) | player | Probability of playing next GW (0–100). Null in the API means fully fit; filled to 100 [0–100] |
| `goals_scored` | fpl | ✅ live | number | player | Goals scored this season [0–50] |
| `assists` | fpl | ✅ live | number | player | Assists this season [0–30] |
| `clean_sheets` | fpl | ✅ live | number | player | Clean sheets this season [0–38] |
| `saves` | fpl | ✅ live | number | player | Goalkeeper saves this season (3 saves = 1 FPL point) [0–300] |
| `goals_conceded` | fpl | ✅ live | number | player | Goals conceded this season [0–100] |
| `own_goals` | fpl | ✅ live | number | player | Own goals this season [0–10] |
| `penalties_saved` | fpl | ✅ live | number | player | Penalties saved this season [0–10] |
| `penalties_missed` | fpl | ✅ live | number | player | Penalties missed this season [0–10] |
| `yellow_cards` | fpl | ✅ live | number | player | Yellow cards this season [0–15] |
| `red_cards` | fpl | ✅ live | number | player | Red cards this season [0–5] |
| `expected_goals` | fpl | ✅ live | number | player | Expected goals (xG) season total from the FPL data feed [0–40] |
| `expected_assists` | fpl | ✅ live | number | player | Expected assists (xA) season total [0–25] |
| `expected_goal_involvements` | fpl | ✅ live | number | player | Expected goal involvements (xGI = xG + xA) season total [0–60] |
| `expected_goals_per_90` | fpl | ✅ live | number (per 90) | player | xG per 90 minutes [0–2] |
| `expected_assists_per_90` | fpl | ✅ live | number (per 90) | player | xA per 90 minutes [0–1.5] |
| `expected_goal_involvements_per_90` | fpl | ✅ live | number (per 90) | player | xGI per 90 minutes [0–2.5] |
| `fdr` | fpl | ✅ live | number | player | Fixture Difficulty Rating for next fixture (1=easiest, 5=hardest). Not in bootstrap-static; filled to 3 (neutral) until a fixture loader is wired (backlog). [1–5] |
| `transfers_in_event` | fpl | ✅ live | number | player | Net transfers in this gameweek [0–2000000] |
| `transfers_out_event` | fpl | ✅ live | number | player | Net transfers out this gameweek [0–2000000] |
| `defensive_contribution` | fpl | ✅ live | number | player | Season defensive contribution points (2025-26 rule: awarded for high CBI/tackle counts) [0–100] |
| `defensive_contribution_per_90` | fpl | ✅ live | number (per 90) | player | Defensive contribution points per 90 minutes [0–5] |
| `clearances_blocks_interceptions` | fpl | ✅ live | number | player | CBI total this season — clearances + blocks + interceptions [0–300] |

---

## football-data.org fields (`football_data` source — 22 fields, proposed)

Access as qualified names: `football_data.<field>` (e.g. `football_data.fd_goals`).

### Player scorer stats (8 fields)

From `GET /v4/competitions/{code}/scorers`. Sparse — only players who scored appear;
all others receive 0. Matched via `name_match` (name + dateOfBirth).

| Field | Source | Status | Type | Entity | Description |
|-------|--------|--------|------|--------|-------------|
| `football_data.fd_goals` | football_data | 🔷 proposed | number | player | Goals scored this season per football-data.org (includes penalties). Sparse — 0 for non-scorers. [0–50] |
| `football_data.fd_assists` | football_data | 🔷 proposed | number | player | Assists this season per football-data.org. Sparse — 0 for players not appearing in /scorers. [0–30] |
| `football_data.fd_penalties` | football_data | 🔷 proposed | number | player | Penalty goals this season (subset of fd_goals). Sparse — 0 for non-scorers. [0–20] |
| `football_data.fd_played_matches` | football_data | 🔷 proposed | number | player | Matches appeared in per football-data.org /scorers. Sparse — 0 for non-scorers (not a full appearances count). [0–38] |
| `football_data.fd_goals_per_90` | football_data | 🔷 proposed | number (per 90) | player | Goals per 90 minutes (fd_goals / fd_played_matches * 90). 0 when fd_played_matches = 0. [0–3] |
| `football_data.fd_assists_per_90` | football_data | 🔷 proposed | number (per 90) | player | Assists per 90 minutes (fd_assists / fd_played_matches * 90). 0 when fd_played_matches = 0. [0–2] |
| `football_data.fd_goal_involvements` | football_data | 🔷 proposed | number | player | Total direct goal contributions (fd_goals + fd_assists). Sparse — 0 for non-scorers. [0–60] |
| `football_data.fd_penalty_share` | football_data | 🔷 proposed | number | player | Fraction of goals that came from penalties (fd_penalties / (fd_goals + 1)). High value = penalty-dependent scorer. [0–1] |

### Team standings (9 fields)

From `GET /v4/competitions/PL/standings`. Dense — every team has a row.
Broadcast to all FPL players on that team via `team_broadcast` strategy.

| Field | Source | Status | Type | Entity | Description |
|-------|--------|--------|------|--------|-------------|
| `football_data.table_position` | football_data | 🔷 proposed | number | team → player | Current league table position (1 = top). Broadcast to all players on the team. [1–20] |
| `football_data.table_points` | football_data | 🔷 proposed | number | team → player | Cumulative league points this season. Broadcast to all players on the team. [0–114] |
| `football_data.goal_difference` | football_data | 🔷 proposed | number | team → player | Season goal difference (goals_for − goals_against). Can be negative. Broadcast. [-80–80] |
| `football_data.goals_for` | football_data | 🔷 proposed | number | team → player | Team goals scored this season (total, not per-player). Broadcast. [0–120] |
| `football_data.goals_against` | football_data | 🔷 proposed | number | team → player | Team goals conceded this season (total). Broadcast. [0–120] |
| `football_data.wins` | football_data | 🔷 proposed | number | team → player | Season wins. Broadcast. [0–38] |
| `football_data.draws` | football_data | 🔷 proposed | number | team → player | Season draws. Broadcast. [0–38] |
| `football_data.losses` | football_data | 🔷 proposed | number | team → player | Season losses. Broadcast. [0–38] |
| `football_data.played_games` | football_data | 🔷 proposed | number | team → player | Matches played by the team this season (max 38). Broadcast. [0–38] |

### Cross-league transfer priors (5 fields)

From `GET /v4/competitions/{SA|FL1}/scorers?season=PREV`. Sparse — only players
who scored in the prior league appear; all others receive 0.
Matched via `name_match` across leagues (name + dateOfBirth).

> **Risk**: historical /scorers free-tier reachability is **unverified**. Verify with:
> ```bash
> FOOTBALL_DATA_TOKEN=<token> curl -s \
>   "https://api.football-data.org/v4/competitions/SA/scorers?season=2024&limit=5" \
>   -H "X-Auth-Token: $FOOTBALL_DATA_TOKEN"
> ```
> If 403 → cross-league priors require a paid plan; `prior_*` fields are unavailable.

| Field | Source | Status | Type | Entity | Description |
|-------|--------|--------|------|--------|-------------|
| `football_data.prior_goals` | football_data | 🔷 proposed | number | prior → player | Goals scored in previous season (SA or FL1) for cross-league transfers. 0 for players with no cross-league prior record. [0–40] |
| `football_data.prior_assists` | football_data | 🔷 proposed | number | prior → player | Assists in previous season (SA or FL1) for cross-league transfers. 0 for no prior. [0–25] |
| `football_data.prior_played_matches` | football_data | 🔷 proposed | number | prior → player | Matches appeared in prior season (SA/FL1). 0 for no prior. [0–38] |
| `football_data.prior_goals_per_90` | football_data | 🔷 proposed | number (per 90) | prior → player | Prior-season goals per 90 minutes (prior_goals / prior_played_matches * 90). 0 for no prior. [0–3] |
| `football_data.prior_assists_per_90` | football_data | 🔷 proposed | number (per 90) | prior → player | Prior-season assists per 90 minutes. 0 for no prior. [0–2] |

---

## Opportunities

Cross-source factor examples — each combines at least one FPL field with at least one
football-data field (or documents a proxy where data is unavailable). Every expression
is valid fplang syntax once ticket 028 is implemented.

```
fd_goal_rate = football_data.fd_goals_per_90
```
> Uses: `football_data.fd_goals_per_90`. Raw scoring rate from an independent source; cross-check on FPL goals_scored.

```
fd_involvement_rate = football_data.fd_goals_per_90 + football_data.fd_assists_per_90
```
> Uses: `football_data.fd_goals_per_90`, `football_data.fd_assists_per_90`. Total attacking contribution rate (goals + assists per 90). No FPL equivalent.

```
finishing_edge = football_data.fd_goals - expected_goals
```
> Uses: `football_data.fd_goals`, `expected_goals`. Goals scored (fd) minus xG (FPL): positive = outperforming expected; negative = underperforming.

```
assist_over_xa = football_data.fd_assists - expected_assists
```
> Uses: `football_data.fd_assists`, `expected_assists`. Same over/under concept for assists. Highlights creative players who convert chances.

```
involvement_over_xgi = football_data.fd_goal_involvements - expected_goal_involvements
```
> Uses: `football_data.fd_goal_involvements`, `expected_goal_involvements`. Combined outperformance vs expected goal involvements.

```
penalty_reliance = football_data.fd_penalties / (football_data.fd_goals + 1)
```
> Uses: `football_data.fd_penalties`, `football_data.fd_goals`. How penalty-dependent is the scorer? High = risky if penalty duties change. +1 avoids div-zero.

```
non_pen_goals = football_data.fd_goals - football_data.fd_penalties
```
> Uses: `football_data.fd_goals`, `football_data.fd_penalties`. Open-play goals only — filters out penalty-takers for a "pure" scoring signal.

```
value_output = football_data.fd_goal_involvements / price
```
> Uses: `football_data.fd_goal_involvements`, `price`. Direct goal contributions per £m of price. Surfaces value picks.

```
scoring_signal = z(football_data.fd_goals_per_90) + z(goals_scored) + z(expected_goals)
```
> Uses: `football_data.fd_goals_per_90`, `goals_scored`, `expected_goals`. Composite: independent scorer rate + FPL goals + FPL xG. Three-source confirmation.

```
team_strength = z(-football_data.table_position) + z(football_data.goal_difference)
```
> Uses: `football_data.table_position`, `football_data.goal_difference`. Team quality blend: inverted rank + goal difference. Prefer over FPL static strength.

```
team_attack_ctx = z(football_data.goals_for) + z(football_data.wins)
```
> Uses: `football_data.goals_for`, `football_data.wins`. Attacking team context. Boosts attackers and midfielders on prolific sides.

```
team_defensive_ctx = z(-football_data.goals_against) + z(football_data.wins)
```
> Uses: `football_data.goals_against`, `football_data.wins`. Defensive team quality. Boosts keepers and defenders on low-conceding sides.

```
table_adjusted_form = z(form) * z(-football_data.table_position)
```
> Uses: `form`, `football_data.table_position`. FPL rolling form weighted by team league standing. Discounts form on weak sides.

```
attacker_team_boost = z(threat) + z(football_data.goals_for)
```
> Uses: `threat`, `football_data.goals_for`. Individual threat (FPL) × team scoring output (fd). Targets attackers on high-scoring teams.

```
defender_cs_proxy = z(-football_data.goals_against) + z(clean_sheets)
```
> Uses: `football_data.goals_against`, `clean_sheets`. Team concession rate + player clean sheets: double-signal for defenders and goalkeepers.

```
new_signing_form = z(football_data.prior_goals_per_90) + z(football_data.prior_assists_per_90)
```
> Uses: `football_data.prior_goals_per_90`, `football_data.prior_assists_per_90`. Prior-season rate signal for newly transferred EPL players. 0 for players with no SA/FL1 record.

```
transfer_blend = z(football_data.prior_goals_per_90) * 2 + z(form)
```
> Uses: `football_data.prior_goals_per_90`, `form`. Weighted blend: prior-season rate (double weight) + current FPL form. Best for early-season GW.

```
prior_value = football_data.prior_goals + football_data.prior_assists
```
> Uses: `football_data.prior_goals`, `football_data.prior_assists`. Raw prior-league involvement total. Quick scan for which signings had the most output.

```
shot_volume_proxy = z(threat) + z(expected_goals)
```
> Uses: `threat`, `expected_goals`. Shots not available in football-data.org. This pair from FPL is the best free-tier proxy for shot volume.

```
attacker_pick = z(threat) + z(expected_goals) + z(football_data.prior_goals_per_90)
```
> Uses: `threat`, `expected_goals`, `football_data.prior_goals_per_90`. Shot proxy + transfer prior: full signal for an attacker new to the EPL.

```
captain_score = z(form) + z(football_data.fd_goals_per_90) + z(-football_data.table_position)
```
> Uses: `form`, `football_data.fd_goals_per_90`, `football_data.table_position`. Captaincy signal: recent form + scoring rate + team quality. Three independent dimensions.
