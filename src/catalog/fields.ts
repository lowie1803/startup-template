import type { FieldDef } from '../types.js';

/**
 * Vendored FPL field catalog — base data fields available in the player panel.
 * This is the set of fields used by the sample factors (scoring.factors, captain.factors, etc.).
 * Extended as new data sources are added.
 */
export const FPL_FIELDS: FieldDef[] = [
  // ── Identity ─────────────────────────────────────────────────────────────
  { name: 'id',       type: 'number', description: 'FPL element ID' },
  { name: 'web_name', type: 'string', description: 'Short display name' },
  { name: 'position', type: 'string', description: 'Position: GKP, DEF, MID, FWD' },
  { name: 'team',     type: 'string', description: 'Team short name' },

  // ── Price & ownership ────────────────────────────────────────────────────
  { name: 'price',              type: 'number', description: 'Current price in £m (now_cost / 10)' },
  { name: 'selected_by_percent', type: 'number', description: 'Ownership %' },

  // ── Points & form ────────────────────────────────────────────────────────
  { name: 'total_points', type: 'number', description: 'Season total points' },
  { name: 'form',         type: 'number', description: 'FPL rolling form score (last 4 GWs avg)' },
  { name: 'bps',          type: 'number', description: 'Bonus point system total' },
  { name: 'bonus',        type: 'number', description: 'Bonus points earned' },
  { name: 'ict_index',    type: 'number', description: 'ICT Index (influence + creativity + threat)' },

  // ── Playing time ─────────────────────────────────────────────────────────
  { name: 'minutes', type: 'number', description: 'Total minutes played' },
  { name: 'chance_of_playing_next_round', type: 'number', description: 'Availability % (0-100, null if unknown)' },

  // ── Goals & assists ───────────────────────────────────────────────────────
  { name: 'goals_scored', type: 'number', description: 'Goals scored' },
  { name: 'assists',      type: 'number', description: 'Assists' },
  { name: 'clean_sheets', type: 'number', description: 'Clean sheets' },
  { name: 'saves',        type: 'number', description: 'Goalkeeper saves' },
  { name: 'goals_conceded', type: 'number', description: 'Goals conceded' },
  { name: 'own_goals',    type: 'number', description: 'Own goals' },
  { name: 'penalties_saved',  type: 'number', description: 'Penalties saved' },
  { name: 'penalties_missed', type: 'number', description: 'Penalties missed' },
  { name: 'yellow_cards', type: 'number', description: 'Yellow cards' },
  { name: 'red_cards',    type: 'number', description: 'Red cards' },

  // ── xStats ───────────────────────────────────────────────────────────────
  { name: 'expected_goals',              type: 'number', description: 'xG season total' },
  { name: 'expected_assists',            type: 'number', description: 'xA season total' },
  { name: 'expected_goal_involvements',  type: 'number', description: 'xGI = xG + xA' },
  { name: 'expected_goals_per_90',       type: 'number', description: 'xG per 90 mins' },
  { name: 'expected_assists_per_90',     type: 'number', description: 'xA per 90 mins' },
  { name: 'expected_goal_involvements_per_90', type: 'number', description: 'xGI per 90 mins' },

  // ── Fixture ───────────────────────────────────────────────────────────────
  { name: 'fdr', type: 'number', description: 'Fixture Difficulty Rating for next fixture (1=easy, 5=hard)' },

  // ── Transfers ────────────────────────────────────────────────────────────
  { name: 'transfers_in_event',  type: 'number', description: 'GW transfers in' },
  { name: 'transfers_out_event', type: 'number', description: 'GW transfers out' },

  // ── DefCon (2025-26 rule) ─────────────────────────────────────────────────
  { name: 'defensive_contribution',       type: 'number', description: 'Season defensive contribution points' },
  { name: 'defensive_contribution_per_90', type: 'number', description: 'Defensive contribution per 90' },
  { name: 'clearances_blocks_interceptions', type: 'number', description: 'CBI total' },
];
