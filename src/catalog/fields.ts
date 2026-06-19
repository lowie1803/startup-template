import type { FieldDef } from '../types.js';

/**
 * The `fpl` source field catalog — base data fields from the FPL API bootstrap-static.json.
 * This is the single source of truth for the built-in `fpl` data source.
 *
 * Rules:
 * - Every field carries `source: 'fpl'` (required by FieldDef, drives sema).
 * - description is required — it powers autocomplete hover and the data-source skill.
 * - fill is required — declares how NaN/null is eliminated at the fill step so the
 *   dataset passes the well-formedness validator (zero NaN after fill, all rows).
 *
 * Fill decisions:
 * - `none`           — FPL API always supplies a non-null value for this field.
 * - `constant: 100`  — chance_of_playing_next_round: null means "fully fit" = 100%.
 * - `constant: 3`    — fdr: not in bootstrap-static; 3 = neutral difficulty until
 *                      a fixture loader (backlog 024) fills it from fixtures.json.
 * - `zero`           — defensive stat fields that may be absent on some element objects
 *                      (pre-DefCon players, API version gaps).
 */
export const FPL_FIELDS: FieldDef[] = [
  // ── Identity ─────────────────────────────────────────────────────────────
  {
    name: 'id', source: 'fpl', type: 'number',
    description: 'FPL element ID — unique integer per player across the season',
    fill: { kind: 'none' }, range: [1, 9999],
  },
  {
    name: 'web_name', source: 'fpl', type: 'string',
    description: 'Short display name as shown on the FPL website (e.g. "Salah")',
    fill: { kind: 'none' },
  },
  {
    name: 'position', source: 'fpl', type: 'string',
    description: 'Position: GKP, DEF, MID, or FWD (derived from element_type 1–4)',
    fill: { kind: 'none' },
  },
  {
    name: 'team', source: 'fpl', type: 'string',
    description: 'Team short name, e.g. "LIV", "ARS", "MCI"',
    fill: { kind: 'none' },
  },

  // ── Price & ownership ────────────────────────────────────────────────────
  {
    name: 'price', source: 'fpl', type: 'number', unit: '£m',
    description: 'Current price in £m (now_cost / 10)',
    fill: { kind: 'none' }, range: [3.0, 20.0],
  },
  {
    name: 'selected_by_percent', source: 'fpl', type: 'number', unit: '%',
    description: 'Ownership as a percentage of all FPL managers',
    fill: { kind: 'none' }, range: [0, 100],
  },

  // ── Points & form ────────────────────────────────────────────────────────
  {
    name: 'total_points', source: 'fpl', type: 'number',
    description: 'Season total FPL points',
    fill: { kind: 'none' }, range: [0, 400],
  },
  {
    name: 'form', source: 'fpl', type: 'number',
    description: 'FPL rolling form score — average points over the last 4 gameweeks',
    fill: { kind: 'none' }, range: [0, 20],
  },
  {
    name: 'bps', source: 'fpl', type: 'number',
    description: 'Bonus point system total for the season',
    fill: { kind: 'none' }, range: [0, 2000],
  },
  {
    name: 'bonus', source: 'fpl', type: 'number',
    description: 'Total bonus points earned this season (1–3 per game)',
    fill: { kind: 'none' }, range: [0, 200],
  },
  {
    name: 'ict_index', source: 'fpl', type: 'number',
    description: 'ICT Index — composite of influence, creativity, and threat scores',
    fill: { kind: 'none' }, range: [0, 500],
  },

  // ── Playing time ─────────────────────────────────────────────────────────
  {
    name: 'minutes', source: 'fpl', type: 'number', unit: 'min',
    description: 'Total minutes played this season',
    fill: { kind: 'none' }, range: [0, 3780],
  },
  {
    name: 'starts', source: 'fpl', type: 'number',
    description: 'Number of matches started this season',
    fill: { kind: 'zero' }, range: [0, 38],
  },
  {
    name: 'chance_of_playing_this_round', source: 'fpl', type: 'number', unit: '%',
    description: 'Probability of playing this GW (0–100). Null means fully fit; filled to 100',
    fill: { kind: 'constant', value: 100 }, range: [0, 100],
  },
  {
    name: 'chance_of_playing_next_round', source: 'fpl', type: 'number', unit: '%',
    description: 'Probability of playing next GW (0–100). Null in the API means fully fit; filled to 100',
    fill: { kind: 'constant', value: 100 }, range: [0, 100],
  },

  // ── Goals & assists ───────────────────────────────────────────────────────
  {
    name: 'goals_scored', source: 'fpl', type: 'number',
    description: 'Goals scored this season',
    fill: { kind: 'none' }, range: [0, 50],
  },
  {
    name: 'assists', source: 'fpl', type: 'number',
    description: 'Assists this season',
    fill: { kind: 'none' }, range: [0, 30],
  },
  {
    name: 'clean_sheets', source: 'fpl', type: 'number',
    description: 'Clean sheets this season',
    fill: { kind: 'none' }, range: [0, 38],
  },
  {
    name: 'saves', source: 'fpl', type: 'number',
    description: 'Goalkeeper saves this season (3 saves = 1 FPL point)',
    fill: { kind: 'none' }, range: [0, 300],
  },
  {
    name: 'goals_conceded', source: 'fpl', type: 'number',
    description: 'Goals conceded this season',
    fill: { kind: 'none' }, range: [0, 100],
  },
  {
    name: 'own_goals', source: 'fpl', type: 'number',
    description: 'Own goals this season',
    fill: { kind: 'none' }, range: [0, 10],
  },
  {
    name: 'penalties_saved', source: 'fpl', type: 'number',
    description: 'Penalties saved this season',
    fill: { kind: 'none' }, range: [0, 10],
  },
  {
    name: 'penalties_missed', source: 'fpl', type: 'number',
    description: 'Penalties missed this season',
    fill: { kind: 'none' }, range: [0, 10],
  },
  {
    name: 'yellow_cards', source: 'fpl', type: 'number',
    description: 'Yellow cards this season',
    fill: { kind: 'none' }, range: [0, 15],
  },
  {
    name: 'red_cards', source: 'fpl', type: 'number',
    description: 'Red cards this season',
    fill: { kind: 'none' }, range: [0, 5],
  },

  // ── xStats ───────────────────────────────────────────────────────────────
  {
    name: 'expected_goals', source: 'fpl', type: 'number',
    description: 'Expected goals (xG) season total from the FPL data feed',
    fill: { kind: 'none' }, range: [0, 40],
  },
  {
    name: 'expected_assists', source: 'fpl', type: 'number',
    description: 'Expected assists (xA) season total',
    fill: { kind: 'none' }, range: [0, 25],
  },
  {
    name: 'expected_goal_involvements', source: 'fpl', type: 'number',
    description: 'Expected goal involvements (xGI = xG + xA) season total',
    fill: { kind: 'none' }, range: [0, 60],
  },
  {
    name: 'expected_goals_per_90', source: 'fpl', type: 'number', unit: 'per 90',
    description: 'xG per 90 minutes',
    fill: { kind: 'none' }, range: [0, 2],
  },
  {
    name: 'expected_assists_per_90', source: 'fpl', type: 'number', unit: 'per 90',
    description: 'xA per 90 minutes',
    fill: { kind: 'none' }, range: [0, 1.5],
  },
  {
    name: 'expected_goal_involvements_per_90', source: 'fpl', type: 'number', unit: 'per 90',
    description: 'xGI per 90 minutes',
    fill: { kind: 'none' }, range: [0, 2.5],
  },

  // ── Fixture ───────────────────────────────────────────────────────────────
  {
    name: 'fdr', source: 'fpl', type: 'number',
    description: 'Fixture Difficulty Rating for next fixture (1=easiest, 5=hardest). Not in bootstrap-static; filled to 3 (neutral) until a fixture loader is wired (backlog).',
    fill: { kind: 'constant', value: 3 }, range: [1, 5],
  },

  // ── Transfers ────────────────────────────────────────────────────────────
  {
    name: 'transfers_in_event', source: 'fpl', type: 'number',
    description: 'Net transfers in this gameweek',
    fill: { kind: 'none' }, range: [0, 2_000_000],
  },
  {
    name: 'transfers_out_event', source: 'fpl', type: 'number',
    description: 'Net transfers out this gameweek',
    fill: { kind: 'none' }, range: [0, 2_000_000],
  },

  // ── DefCon (2025-26 rule) ─────────────────────────────────────────────────
  {
    name: 'defensive_contribution', source: 'fpl', type: 'number',
    description: 'Season defensive contribution points (2025-26 rule: awarded for high CBI/tackle counts)',
    fill: { kind: 'zero' }, range: [0, 100],
  },
  {
    name: 'defensive_contribution_per_90', source: 'fpl', type: 'number', unit: 'per 90',
    description: 'Defensive contribution points per 90 minutes',
    fill: { kind: 'zero' }, range: [0, 5],
  },
  {
    name: 'clearances_blocks_interceptions', source: 'fpl', type: 'number',
    description: 'CBI total this season — clearances + blocks + interceptions',
    fill: { kind: 'zero' }, range: [0, 300],
  },
];
