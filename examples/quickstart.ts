/**
 * fplang quickstart — runnable demo
 *
 * Shows how to evaluate a factor library against the vendored sample panel
 * (15 real FPL 2025-26 players, no network required).
 *
 * Run:  npx tsx examples/quickstart.ts
 *   or: npm run example
 */

import { evaluate, listFields } from '../src/index.ts';
import { buildSamplePanel } from '../data/sample-panel.ts';

// ── Factor library (scalar only — what the runtime supports today) ────────────
//
// Functions available now: iff, coalesce, per90, min, max,
//   abs, sqrt, log, pow, round, floor, ceil
// + arithmetic:  + - * / %   comparison:  == != < > <= >=
//
// Cross-sectional (rank/z/zscore/…) → backlog 010 (not yet evaluable)
// Time-series    (ts_mean/ts_delta/…) → backlog 011 (not yet evaluable)
//
const FACTORS = `
# ── Value metrics ──────────────────────────────────────────────────────────────
value        = total_points / price         # points per £m
ppg90        = per90(total_points, minutes) # points per 90 min

# ── Playing time ───────────────────────────────────────────────────────────────
nailed       = iff(minutes > 1500, 1, 0)   # 1 = starter, 0 = rotation risk
available    = coalesce(chance_of_playing_next_round, 100) / 100

# ── Production metrics ─────────────────────────────────────────────────────────
xg_over      = goals_scored - expected_goals
bps90        = per90(bps, minutes)

# ── Transfer signals ───────────────────────────────────────────────────────────
net_transfers = transfers_in_event - transfers_out_event

# ── GK-specific ────────────────────────────────────────────────────────────────
saves_pts    = iff(position == "GKP", saves / 3, 0)
`;

// ── Evaluate ──────────────────────────────────────────────────────────────────

const panel = buildSamplePanel();
const fields = listFields();

const { panel: result, factorNames, diagnostics } = evaluate(FACTORS, panel, fields);

if (diagnostics.length > 0) {
  console.error('Diagnostics:');
  for (const d of diagnostics) console.error(' ', d.severity, d.message);
  process.exit(1);
}

console.log(`✓ Evaluated ${factorNames.length} factors on ${result.rowCount} players\n`);

// ── Print ranked table (by value, descending) ─────────────────────────────────

type Row = {
  name: string;
  pos: string;
  price: number;
  pts: number;
  value: number;
  ppg90: number;
  nailed: number;
  xg_over: number;
  net_tx: number;
};

const rows: Row[] = [];
for (let i = 0; i < result.rowCount; i++) {
  rows.push({
    name:    (result.getColumn('web_name') as string[])[i]!,
    pos:     (result.getColumn('position') as string[])[i]!,
    price:   (result.getColumn('price') as Float64Array)[i]!,
    pts:     (result.getColumn('total_points') as Float64Array)[i]!,
    value:   (result.getColumn('value') as Float64Array)[i]!,
    ppg90:   (result.getColumn('ppg90') as Float64Array)[i]!,
    nailed:  (result.getColumn('nailed') as Float64Array)[i]!,
    xg_over: (result.getColumn('xg_over') as Float64Array)[i]!,
    net_tx:  (result.getColumn('net_transfers') as Float64Array)[i]!,
  });
}

rows.sort((a, b) => b.value - a.value);

const fmt = (n: number, dp = 2) =>
  Number.isFinite(n) ? n.toFixed(dp) : 'null';

console.log(
  'Name'.padEnd(18),
  'Pos'.padEnd(4),
  '£'.padStart(5),
  'Pts'.padStart(5),
  'Value'.padStart(6),
  'PPG90'.padStart(6),
  'Nailed'.padStart(7),
  'xGΔ'.padStart(6),
  'Net Tx'.padStart(8),
);
console.log('─'.repeat(75));

for (const r of rows) {
  console.log(
    r.name.padEnd(18),
    r.pos.padEnd(4),
    fmt(r.price, 1).padStart(5),
    fmt(r.pts, 0).padStart(5),
    fmt(r.value).padStart(6),
    fmt(r.ppg90).padStart(6),
    fmt(r.nailed, 0).padStart(7),
    fmt(r.xg_over).padStart(6),
    (r.net_tx > 0 ? '+' : '') + fmt(r.net_tx, 0).padStart(7),
  );
}

console.log('\n' + '─'.repeat(75));
console.log('Value = total_points / price   |   PPG90 = points per 90 min');
console.log('Nailed = 1 if minutes > 1500   |   xGΔ = goals_scored − xG');
