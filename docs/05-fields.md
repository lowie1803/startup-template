# Fields — Data Catalog

All fields available in factor expressions when `source: players` (the default). Fields from
other sources are listed at the end.

The raw FPL `element` object has **105 fields**. Today's DSL surfaces ~28. This document is
the **canonical list** — the field catalog, autocomplete, hover docs, and the Data Inventory
UI are all generated from it (single source of truth).

---

## Currently surfaced (players source)

Already in `dslSources.js` `players.fields[]`:

| Field | Type | Description |
|---|---|---|
| `name` | str | Player web name |
| `team` | str | Team short name (e.g. `"LIV"`) |
| `position` | str | `"GKP"` / `"DEF"` / `"MID"` / `"FWD"` |
| `price` | num | Current price (£) — `now_cost / 10` |
| `total_points` | num | Season total points |
| `points_per_game` | num | Avg points per game played |
| `form` | num | Recent form — FPL's own last-5 GW average |
| `minutes` | num | Minutes played this season |
| `goals_scored` | num | Goals scored |
| `assists` | num | Assists |
| `clean_sheets` | num | Clean sheets |
| `bonus` | num | Bonus points this season |
| `bps` | num | BPS score this season |
| `expected_goals` | num | xG |
| `expected_assists` | num | xA |
| `expected_goal_involvements` | num | xGI |
| `ict_index` | num | ICT index |
| `influence` | num | Influence component |
| `creativity` | num | Creativity component |
| `threat` | num | Threat component |
| `selected_by_percent` | num | Ownership % |
| `fdr` | num | Fixture difficulty sum — next 3 GWs |
| `fdr_def` | num | Defensive FDR — next 3 GWs |
| `fdr_att` | num | Attacking FDR — next 3 GWs |
| `transfers_in_event` | num | Transfers in this GW |
| `transfers_out_event` | num | Transfers out this GW |
| `cost_change_event` | num | Price change this GW (in 0.1£ units) |

---

## To expose (exist on raw element, not yet catalogued)

These fields are present on the raw FPL `element` object and already pass through the player
spread (`{ ...el }`) — they just aren't in the catalog, so autocomplete, hover, and the Data
Inventory tab don't know about them. Adding them requires only updating `dslSources.js`.

### Availability / injury

| Field | Type | Description |
|---|---|---|
| `status` | str | `"a"` available · `"d"` doubtful · `"i"` injured · `"u"` unavailable · `"s"` suspended |
| `chance_of_playing_next_round` | num | Likelihood of playing next GW (0–100, null if certain) |
| `chance_of_playing_this_round` | num | Likelihood of playing this GW |
| `news` | str | FPL news string (free text — use in display, not expressions) |

`chance_of_playing_next_round` is the key one: it enables the `available` factor and
`risk_adj_xpts`. It's null for fully fit players — hence `coalesce(chance_of_playing_next_round, 100)`.

### FPL projections

| Field | Type | Description |
|---|---|---|
| `ep_next` | num | FPL's own expected points next GW |
| `ep_this` | num | FPL's own expected points this GW |
| `value_form` | num | FPL's form-adjusted value metric |
| `value_season` | num | FPL's season value metric |

These are FPL's own model outputs — useful as baselines to compare/beat with custom factors.

### Price history

| Field | Type | Description |
|---|---|---|
| `cost_change_start` | num | Total price change since season start (0.1£ units) |
| `cost_change_start_fall` | num | Price rise since start (positive = rose) |

`cost_change_start / 10` gives the £ movement since GW1. Useful for "which cheap players have
already risen?" queries.

### Goalkeeping

| Field | Type | Description |
|---|---|---|
| `saves` | num | Saves this season (3 saves = 1 FPL point) |

Already present in some places but not in the field catalog.

### Set-piece ordering — verified on live API

Per-player numeric ordering fields. `1` = first choice, `2` = backup, `null` = not a taker.
132 players currently have at least one field set.

**Known limitation:** teams typically have left-side and right-side corner takers, both
listed under the same `corners_and_indirect_freekicks_order` field with no side indicator.
A team with 4 corner takers listed is almost certainly a left/right split — the order field
alone cannot tell you which side each player covers. Use `creativity / starts` as a volume
proxy to identify active deliverers vs theoretical backups.

| Field | Type | Description |
|---|---|---|
| `penalties_order` | num | Penalty taker order (1 = first choice, 2 = backup, null = not a taker) |
| `corners_and_indirect_freekicks_order` | num | Corners + indirect FK order — does not distinguish left/right |
| `direct_freekicks_order` | num | Direct free kick taker order |
| `penalties_text` | str | Supplementary text (empty in practice — use order field) |
| `corners_and_indirect_freekicks_text` | str | Supplementary text (empty in practice) |
| `direct_freekicks_text` | str | Supplementary text (empty in practice) |

Also needed for set-piece volume analysis:

| Field | Type | Description |
|---|---|---|
| `starts` | num | Games started this season — required to compute `creativity / starts` as a delivery-rate proxy |

### Defensive contribution (2025-26 rule) — verified on live API

| Field | Type | Description |
|---|---|---|
| `defensive_contribution` | num | DefCon points earned this season |
| `defensive_contribution_per_90` | num | DefCon points per 90 mins |
| `clearances_blocks_interceptions` | num | CBI count this season |
| `tackles` | num | Tackles this season |
| `recoveries` | num | Ball recoveries this season |

The 2025-26 rule awards **2 pts** when a player clears a match-level defensive action
threshold (DEF: ≥10 CBI+tackles; MID/FWD: ≥12 incl. recoveries). All five fields confirmed
present on the live endpoint.

### Other high-value raw fields

| Field | Type | Description |
|---|---|---|
| `expected_goals_conceded` | num | xGC — defensive quality metric |
| `goals_conceded` | num | Goals conceded |
| `own_goals` | num | Own goals |
| `penalties_missed` | num | Penalties missed |
| `yellow_cards` | num | Yellow cards |
| `red_cards` | num | Red cards |

These are in `NUMERIC_FIELDS` in `fplParser.js` and already coerced — just not in the catalog.

---

## Series fields (time-series via `series(...)`)

Per-gameweek history attached to each player row as `row.__history`. These are referenced
via `series(fieldName)` inside `ts_*` functions.

| `series(...)` | Availability | Description |
|---|---|---|
| `series(points)` | **Now** — from `gwScores` (last 5 GWs) | GW points |
| `series(minutes)` | Snapshot needed (backlog 109) | Minutes played per GW |
| `series(price)` | Snapshot needed | Price at that GW (`value / 10`) |
| `series(net_transfers)` | Snapshot needed | Net transfers that GW |
| `series(goals)` | Snapshot needed | Goals scored that GW |
| `series(assists)` | Snapshot needed | Assists that GW |
| `series(bps)` | Snapshot needed | BPS that GW |
| `series(bonus)` | Snapshot needed | Bonus points that GW |

---

## Other sources

Fields from non-player sources. These are not in scope for factor definitions (factors operate
on player rows) but are available in DataLab pipelines.

### `source: teams`
`id`, `name`, `short_name`, `strength`, `strength_attack_home`, `strength_attack_away`,
`strength_defence_home`, `strength_defence_away`

### `source: fixtures`
`event`, `team_h`, `team_a`, `team_h_difficulty`, `team_a_difficulty`,
`team_h_score`, `team_a_score`, `finished`

### `source: events`
`id`, `name`, `is_current`, `is_next`, `average_entry_score`, `highest_score`, `deadline_time`

### `source: live_scores` (async, requires `gw=N`)
`id`, `total_points`, `minutes`, `goals_scored`, `assists`, `clean_sheets`,
`bonus`, `bps`, `yellow_cards`, `red_cards`, `saves`

### `source: player_history` (async, requires `id=N`)
`round`, `total_points`, `minutes`, `goals_scored`, `assists`, `bonus`, `bps`,
`value`, `selected`, `transfers_in`, `transfers_out`

### `source: dream_team` (async, requires `gw=N`)
`element`, `points`, `position`

### `source: set_piece_notes` (async)
`id`, `notes` (free text — view in JSON tree, not expression-addressable)

---

## Single source of truth

The field catalog (`dslSources.js` → `SOURCE_REGISTRY[source].fields[]`) is the **only**
place field definitions live. Everything else reads from it:

- Editor autocomplete (`dslLang.js` `dslCompletionSource`)
- Editor hover tooltip (field description on hover)
- Semantic linter (unknown field names)
- Data Inventory UI tab (auto-generated from registry)
- Skill docs (auto-generated section)

Do not add field documentation to any of those places manually — update the registry instead.
