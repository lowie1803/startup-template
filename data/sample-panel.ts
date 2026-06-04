/**
 * Vendored sample player panel — ~18 real FPL 2025-26 players across all positions.
 * Offline, instant, no network required. Used by the REPL and unit tests.
 *
 * Data is approximate but realistic; update from a live snapshot (npm run snapshot
 * + loadSnapshot.ts) for production use.
 */

import { Panel } from '../src/runtime/panel.js';

interface PlayerRow {
  id: number;
  web_name: string;
  position: string;
  team: string;
  price: number;
  total_points: number;
  form: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  saves: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  bonus: number;
  bps: number;
  ict_index: number;
  expected_goals: number;
  expected_assists: number;
  expected_goal_involvements: number;
  expected_goals_per_90: number;
  expected_assists_per_90: number;
  expected_goal_involvements_per_90: number;
  selected_by_percent: number;
  fdr: number;
  transfers_in_event: number;
  transfers_out_event: number;
  chance_of_playing_next_round: number;
  defensive_contribution: number;
  defensive_contribution_per_90: number;
  clearances_blocks_interceptions: number;
}

const PLAYERS: PlayerRow[] = [
  // ── Goalkeepers ─────────────────────────────────────────────────────────
  {
    id: 1, web_name: 'Flekken', position: 'GKP', team: 'BRE',
    price: 4.5, total_points: 112, form: 5.2, minutes: 2880,
    goals_scored: 0, assists: 0, clean_sheets: 10, saves: 98,
    goals_conceded: 38, own_goals: 0, penalties_saved: 1, penalties_missed: 0,
    yellow_cards: 0, red_cards: 0, bonus: 8, bps: 342, ict_index: 14.2,
    expected_goals: 0, expected_assists: 0, expected_goal_involvements: 0,
    expected_goals_per_90: 0, expected_assists_per_90: 0, expected_goal_involvements_per_90: 0,
    selected_by_percent: 8.4, fdr: 2, transfers_in_event: 12000, transfers_out_event: 8000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
  {
    id: 2, web_name: 'Raya', position: 'GKP', team: 'ARS',
    price: 5.5, total_points: 155, form: 6.8, minutes: 3060,
    goals_scored: 0, assists: 1, clean_sheets: 14, saves: 110,
    goals_conceded: 28, own_goals: 0, penalties_saved: 2, penalties_missed: 0,
    yellow_cards: 1, red_cards: 0, bonus: 18, bps: 510, ict_index: 22.1,
    expected_goals: 0, expected_assists: 0, expected_goal_involvements: 0,
    expected_goals_per_90: 0, expected_assists_per_90: 0, expected_goal_involvements_per_90: 0,
    selected_by_percent: 22.1, fdr: 3, transfers_in_event: 24000, transfers_out_event: 15000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },

  // ── Defenders ────────────────────────────────────────────────────────────
  {
    id: 3, web_name: 'Alexander-Arnold', position: 'DEF', team: 'LIV',
    price: 7.0, total_points: 148, form: 6.2, minutes: 2700,
    goals_scored: 4, assists: 11, clean_sheets: 10, saves: 0,
    goals_conceded: 32, own_goals: 0, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 3, red_cards: 0, bonus: 22, bps: 610, ict_index: 98.4,
    expected_goals: 3.2, expected_assists: 9.1, expected_goal_involvements: 12.3,
    expected_goals_per_90: 0.11, expected_assists_per_90: 0.30, expected_goal_involvements_per_90: 0.41,
    selected_by_percent: 18.7, fdr: 2, transfers_in_event: 45000, transfers_out_event: 18000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 42, defensive_contribution_per_90: 1.4, clearances_blocks_interceptions: 88,
  },
  {
    id: 4, web_name: 'Pedro Porro', position: 'DEF', team: 'TOT',
    price: 5.8, total_points: 121, form: 5.0, minutes: 2790,
    goals_scored: 2, assists: 8, clean_sheets: 8, saves: 0,
    goals_conceded: 45, own_goals: 0, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 5, red_cards: 0, bonus: 14, bps: 420, ict_index: 72.3,
    expected_goals: 1.9, expected_assists: 6.2, expected_goal_involvements: 8.1,
    expected_goals_per_90: 0.06, expected_assists_per_90: 0.20, expected_goal_involvements_per_90: 0.26,
    selected_by_percent: 11.2, fdr: 3, transfers_in_event: 19000, transfers_out_event: 22000,
    chance_of_playing_next_round: 75,
    defensive_contribution: 35, defensive_contribution_per_90: 1.1, clearances_blocks_interceptions: 72,
  },
  {
    id: 5, web_name: 'Mykolenko', position: 'DEF', team: 'EVE',
    price: 4.5, total_points: 98, form: 3.8, minutes: 2610,
    goals_scored: 1, assists: 3, clean_sheets: 6, saves: 0,
    goals_conceded: 52, own_goals: 1, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 6, red_cards: 0, bonus: 8, bps: 265, ict_index: 38.1,
    expected_goals: 0.8, expected_assists: 2.4, expected_goal_involvements: 3.2,
    expected_goals_per_90: 0.03, expected_assists_per_90: 0.08, expected_goal_involvements_per_90: 0.11,
    selected_by_percent: 3.1, fdr: 2, transfers_in_event: 5000, transfers_out_event: 9000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 28, defensive_contribution_per_90: 0.97, clearances_blocks_interceptions: 61,
  },

  // ── Midfielders ──────────────────────────────────────────────────────────
  {
    id: 6, web_name: 'Salah', position: 'MID', team: 'LIV',
    price: 13.5, total_points: 278, form: 12.4, minutes: 2970,
    goals_scored: 24, assists: 18, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 1, red_cards: 0, bonus: 48, bps: 980, ict_index: 312.8,
    expected_goals: 19.8, expected_assists: 14.2, expected_goal_involvements: 34.0,
    expected_goals_per_90: 0.60, expected_assists_per_90: 0.43, expected_goal_involvements_per_90: 1.03,
    selected_by_percent: 62.4, fdr: 2, transfers_in_event: 120000, transfers_out_event: 42000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
  {
    id: 7, web_name: 'Saka', position: 'MID', team: 'ARS',
    price: 10.2, total_points: 198, form: 8.6, minutes: 2700,
    goals_scored: 14, assists: 12, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 2, red_cards: 0, bonus: 30, bps: 720, ict_index: 198.4,
    expected_goals: 11.2, expected_assists: 10.8, expected_goal_involvements: 22.0,
    expected_goals_per_90: 0.37, expected_assists_per_90: 0.36, expected_goal_involvements_per_90: 0.73,
    selected_by_percent: 34.8, fdr: 3, transfers_in_event: 65000, transfers_out_event: 28000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
  {
    id: 8, web_name: 'Palmer', position: 'MID', team: 'CHE',
    price: 11.0, total_points: 212, form: 9.2, minutes: 2880,
    goals_scored: 18, assists: 14, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 1,
    yellow_cards: 3, red_cards: 0, bonus: 36, bps: 810, ict_index: 226.5,
    expected_goals: 14.5, expected_assists: 11.3, expected_goal_involvements: 25.8,
    expected_goals_per_90: 0.45, expected_assists_per_90: 0.35, expected_goal_involvements_per_90: 0.81,
    selected_by_percent: 41.2, fdr: 2, transfers_in_event: 85000, transfers_out_event: 35000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
  {
    id: 9, web_name: 'Mbeumo', position: 'MID', team: 'BRE',
    price: 8.1, total_points: 182, form: 7.8, minutes: 2790,
    goals_scored: 16, assists: 9, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 2, red_cards: 0, bonus: 28, bps: 660, ict_index: 172.1,
    expected_goals: 13.1, expected_assists: 7.6, expected_goal_involvements: 20.7,
    expected_goals_per_90: 0.42, expected_assists_per_90: 0.25, expected_goal_involvements_per_90: 0.67,
    selected_by_percent: 25.6, fdr: 2, transfers_in_event: 52000, transfers_out_event: 20000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
  {
    id: 10, web_name: 'Diallo', position: 'MID', team: 'MUN',
    price: 6.5, total_points: 134, form: 5.8, minutes: 2340,
    goals_scored: 10, assists: 7, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 3, red_cards: 0, bonus: 16, bps: 480, ict_index: 122.3,
    expected_goals: 8.2, expected_assists: 5.9, expected_goal_involvements: 14.1,
    expected_goals_per_90: 0.32, expected_assists_per_90: 0.23, expected_goal_involvements_per_90: 0.54,
    selected_by_percent: 12.3, fdr: 3, transfers_in_event: 28000, transfers_out_event: 18000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },

  // ── Forwards ─────────────────────────────────────────────────────────────
  {
    id: 11, web_name: 'Haaland', position: 'FWD', team: 'MCI',
    price: 14.5, total_points: 222, form: 10.1, minutes: 2790,
    goals_scored: 26, assists: 5, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 2,
    yellow_cards: 2, red_cards: 0, bonus: 42, bps: 890, ict_index: 258.7,
    expected_goals: 22.4, expected_assists: 4.8, expected_goal_involvements: 27.2,
    expected_goals_per_90: 0.72, expected_assists_per_90: 0.15, expected_goal_involvements_per_90: 0.88,
    selected_by_percent: 48.1, fdr: 3, transfers_in_event: 98000, transfers_out_event: 40000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
  {
    id: 12, web_name: 'Isak', position: 'FWD', team: 'NEW',
    price: 9.0, total_points: 185, form: 8.2, minutes: 2700,
    goals_scored: 20, assists: 6, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 1, red_cards: 0, bonus: 30, bps: 700, ict_index: 192.5,
    expected_goals: 17.2, expected_assists: 4.9, expected_goal_involvements: 22.1,
    expected_goals_per_90: 0.57, expected_assists_per_90: 0.16, expected_goal_involvements_per_90: 0.74,
    selected_by_percent: 28.4, fdr: 2, transfers_in_event: 72000, transfers_out_event: 30000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
  {
    id: 13, web_name: 'Watkins', position: 'FWD', team: 'AVL',
    price: 8.8, total_points: 161, form: 7.0, minutes: 2610,
    goals_scored: 15, assists: 8, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 1,
    yellow_cards: 2, red_cards: 0, bonus: 24, bps: 580, ict_index: 158.9,
    expected_goals: 13.4, expected_assists: 6.8, expected_goal_involvements: 20.2,
    expected_goals_per_90: 0.46, expected_assists_per_90: 0.23, expected_goal_involvements_per_90: 0.70,
    selected_by_percent: 19.8, fdr: 2, transfers_in_event: 38000, transfers_out_event: 25000,
    chance_of_playing_next_round: 75,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
  {
    id: 14, web_name: 'Wissa', position: 'FWD', team: 'BRE',
    price: 6.5, total_points: 138, form: 5.8, minutes: 2430,
    goals_scored: 12, assists: 5, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 3, red_cards: 0, bonus: 18, bps: 420, ict_index: 118.4,
    expected_goals: 9.8, expected_assists: 4.2, expected_goal_involvements: 14.0,
    expected_goals_per_90: 0.36, expected_assists_per_90: 0.16, expected_goal_involvements_per_90: 0.52,
    selected_by_percent: 8.9, fdr: 2, transfers_in_event: 22000, transfers_out_event: 12000,
    chance_of_playing_next_round: 100,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
  {
    id: 15, web_name: 'Firmino', position: 'FWD', team: 'NEW',
    price: 5.5, total_points: 72, form: 2.2, minutes: 1080,
    goals_scored: 6, assists: 3, clean_sheets: 0, saves: 0,
    goals_conceded: 0, own_goals: 0, penalties_saved: 0, penalties_missed: 0,
    yellow_cards: 1, red_cards: 0, bonus: 8, bps: 220, ict_index: 62.1,
    expected_goals: 4.8, expected_assists: 2.6, expected_goal_involvements: 7.4,
    expected_goals_per_90: 0.40, expected_assists_per_90: 0.22, expected_goal_involvements_per_90: 0.62,
    selected_by_percent: 2.1, fdr: 2, transfers_in_event: 4000, transfers_out_event: 8000,
    chance_of_playing_next_round: 50,
    defensive_contribution: 0, defensive_contribution_per_90: 0, clearances_blocks_interceptions: 0,
  },
];

const NUMERIC_FIELDS = [
  'id', 'price', 'total_points', 'form', 'minutes',
  'goals_scored', 'assists', 'clean_sheets', 'saves', 'goals_conceded',
  'own_goals', 'penalties_saved', 'penalties_missed', 'yellow_cards', 'red_cards',
  'bonus', 'bps', 'ict_index',
  'expected_goals', 'expected_assists', 'expected_goal_involvements',
  'expected_goals_per_90', 'expected_assists_per_90', 'expected_goal_involvements_per_90',
  'selected_by_percent', 'fdr', 'transfers_in_event', 'transfers_out_event',
  'chance_of_playing_next_round',
  'defensive_contribution', 'defensive_contribution_per_90', 'clearances_blocks_interceptions',
] as const;

const STRING_FIELDS = ['web_name', 'position', 'team'] as const;

/** Build the vendored sample panel. Returns a fresh Panel on each call. */
export function buildSamplePanel(): Panel {
  const n = PLAYERS.length;
  const init: Record<string, Float64Array | string[]> = {};

  for (const field of NUMERIC_FIELDS) {
    const col = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      col[i] = PLAYERS[i]![field] as number;
    }
    init[field] = col;
  }

  for (const field of STRING_FIELDS) {
    init[field] = PLAYERS.map(p => p[field]);
  }

  return new Panel(n, init);
}
