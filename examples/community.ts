/**
 * fplang community factor cookbook
 *
 * Evaluates the captaincy & transfer alpha library against the vendored
 * 15-player sample panel and prints leaderboards for metrics the FPL
 * community actually uses: captaincy z-stacks, differentials, expected-points
 * decomposition, template/ownership risk, and the 2025-26 DefCon composite.
 *
 * Run:  npx tsx examples/community.ts
 *   or: npm run example:community
 *
 * All factors here use only what's implemented today (Tier 0 scalar + Tier 1
 * domain lookups + Tier 2 cross-sectional). Tier 3 time-series factors are in
 * factors/momentum.factors (pending backlog 011).
 */

import { evaluate, listFields } from '../src/index.ts';
import { buildSamplePanel } from '../data/sample-panel.ts';

// ── Factor library (mirrors factors/captaincy.factors) ────────────────────────

const FACTORS = `
# ── Scoring primitives ─────────────────────────────────────────────────────────
point_from_goals   = goals_scored * goal_points(position)
point_from_assists = assists * assist_points
point_from_cs      = clean_sheets * cs_points(position)
point_from_ga      = point_from_goals + point_from_assists

# ── Expected points (attack) ───────────────────────────────────────────────────
xpts_attack  = expected_goals * goal_points(position) + expected_assists * assist_points
attack_over  = point_from_ga - xpts_attack
xg_over      = goals_scored - expected_goals

# ── Value / fitness ────────────────────────────────────────────────────────────
value        = total_points / price
ppg90        = per90(total_points, minutes)
available    = coalesce(chance_of_playing_next_round, 100) / 100
net_tx       = transfers_in_event - transfers_out_event
fixture_ease = 6 - fdr
bps90        = per90(bps, minutes)

# ── GK-specific ────────────────────────────────────────────────────────────────
saves_pts    = iff(position == "GKP", saves / 3, 0)
gk_value     = iff(position == "GKP", (saves_pts + point_from_cs) / price, 0)

# ── DefCon 2025-26 ─────────────────────────────────────────────────────────────
defcon_rate  = defensive_contribution_per_90
cbi90        = per90(clearances_blocks_interceptions, minutes)

# ── Cross-sectional composites (rank / z — Tier 2) ────────────────────────────
captain      = z(form) + z(fixture_ease) + z(xg_over)
transfer_target = z(form) + z(fixture_ease) + z(value) + z(available)
sell_signal  = z(-form) + z(-net_tx) + z(attack_over)
differential = rank(form) * (1 - selected_by_percent / 100)
eo_edge      = z(xpts_attack) - z(selected_by_percent)
template_risk = iff(selected_by_percent > 30, 1, 0)
rise_pressure = rank(net_tx)
value_rank   = rank(value, position)
form_rank    = rank(form, position)
defcon_floor = z(defcon_rate) + z(point_from_cs)
`;

// ── Evaluate ──────────────────────────────────────────────────────────────────

const panel = buildSamplePanel();
const fields = listFields();
const { panel: result, factorNames, diagnostics } = evaluate(FACTORS, panel, fields);

if (diagnostics.length > 0) {
  console.error('Diagnostics (should be empty):');
  for (const d of diagnostics) console.error(' ', d.severity, d.message);
  process.exit(1);
}

console.log(`✓ ${factorNames.length} factors evaluated on ${result.rowCount} players\n`);

// ── Helpers ───────────────────────────────────────────────────────────────────

type ColMap = Record<string, Float64Array | string[]>;

function col(name: string): Float64Array | string[] {
  return result.getColumn(name)!;
}
function num(name: string): Float64Array { return col(name) as Float64Array; }
function str(name: string): string[] { return col(name) as string[]; }

function fmt(n: number, dp = 2): string {
  return isFinite(n) ? n.toFixed(dp) : 'null';
}
function fmtS(n: number, dp = 2): string {
  return isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(dp) : 'null';
}

const rows = Array.from({ length: result.rowCount }, (_, i) => i);

function leaderboard(
  title: string,
  sortFactor: string,
  ascending = false,
  cols: { label: string; fn: (i: number) => string }[],
  filterFn?: (i: number) => boolean,
  n = 7,
) {
  const sortCol = num(sortFactor);
  let filtered = filterFn ? rows.filter(filterFn) : [...rows];
  filtered = filtered.filter(i => isFinite(sortCol[i]!));
  filtered.sort((a, b) =>
    ascending ? sortCol[a]! - sortCol[b]! : sortCol[b]! - sortCol[a]!,
  );
  const top = filtered.slice(0, n);

  const header = ['Name'.padEnd(18), 'Pos'.padEnd(4), ...cols.map(c => c.label.padStart(9))].join('  ');
  console.log(`\n${'═'.repeat(header.length)}`);
  console.log(` ${title}`);
  console.log('═'.repeat(header.length));
  console.log(header);
  console.log('─'.repeat(header.length));
  for (const i of top) {
    const row = [
      str('web_name')[i]!.padEnd(18),
      str('position')[i]!.padEnd(4),
      ...cols.map(c => c.fn(i).padStart(9)),
    ].join('  ');
    console.log(row);
  }
}

// ── 1. Top captain picks ──────────────────────────────────────────────────────
// Classic community composite: z(form) + z(fixture) + z(xG over-performance)

leaderboard(
  '📌 Top captain picks  [captain = z(form) + z(fixture_ease) + z(xg_over)]',
  'captain',
  false,
  [
    { label: 'Captain',   fn: i => fmtS(num('captain')[i]!) },
    { label: 'Form',      fn: i => fmt(num('form')[i]!) },
    { label: 'Fixture',   fn: i => fmt(num('fixture_ease')[i]!, 0) },
    { label: 'xGΔ',       fn: i => fmtS(num('xg_over')[i]!) },
    { label: 'Own%',      fn: i => fmt(num('selected_by_percent')[i]!) + '%' },
  ],
);

// ── 2. Best differentials ─────────────────────────────────────────────────────
// High form rank × (1 − ownership): under-owned players delivering

leaderboard(
  '🔀 Best differentials  [differential = rank(form) × (1 − own%)]',
  'differential',
  false,
  [
    { label: 'Diff',      fn: i => fmt(num('differential')[i]!, 3) },
    { label: 'FormRnk',   fn: i => fmt(num('form_rank')[i]!, 2) },
    { label: 'Own%',      fn: i => fmt(num('selected_by_percent')[i]!) + '%' },
    { label: 'Price',     fn: i => '£' + fmt(num('price')[i]!, 1) },
    { label: 'PPG90',     fn: i => fmt(num('ppg90')[i]!) },
  ],
  i => num('selected_by_percent')[i]! < 30,  // exclude template players
);

// ── 3. Regression / sell candidates ──────────────────────────────────────────
// High attack_over = massively outperforming expected goals → luck, will regress

leaderboard(
  '📉 Regression candidates  [attack_over = actual GA pts − xPts; higher = luckier]',
  'attack_over',
  false,
  [
    { label: 'AttkΔ',    fn: i => fmtS(num('attack_over')[i]!) },
    { label: 'xGΔ',      fn: i => fmtS(num('xg_over')[i]!) },
    { label: 'xPts',     fn: i => fmt(num('xpts_attack')[i]!, 0) },
    { label: 'AcPts',    fn: i => fmt(num('point_from_ga')[i]!, 0) },
    { label: 'Sell?',    fn: i => fmtS(num('sell_signal')[i]!, 2) },
  ],
);

// ── 4. Best value by position (value rank) ────────────────────────────────────
// rank(total_points/price, position): best PPM within positional group

const posOrder = ['GKP', 'DEF', 'MID', 'FWD'];
console.log(`\n${'═'.repeat(70)}`);
console.log(' 💰 Best value picks  [value_rank = rank(pts/£, position)]  — top 2 per position');
console.log('═'.repeat(70));
console.log(['Name'.padEnd(18), 'Pos'.padEnd(4), 'ValRnk'.padStart(8), 'Value'.padStart(8), '£'.padStart(6), 'Pts'.padStart(6)].join('  '));
console.log('─'.repeat(70));
for (const pos of posOrder) {
  const filtered = rows
    .filter(i => str('position')[i] === pos && isFinite(num('value_rank')[i]!))
    .sort((a, b) => num('value_rank')[b]! - num('value_rank')[a]!)
    .slice(0, 2);
  for (const i of filtered) {
    console.log([
      str('web_name')[i]!.padEnd(18),
      str('position')[i]!.padEnd(4),
      fmt(num('value_rank')[i]!, 2).padStart(8),
      fmt(num('value')[i]!).padStart(8),
      ('£' + fmt(num('price')[i]!, 1)).padStart(6),
      fmt(num('total_points')[i]!, 0).padStart(6),
    ].join('  '));
  }
}

// ── 5. DefCon picks (defensive composite, 2025-26) ────────────────────────────
// Best DEF/GKP by defcon_floor = z(defcon_rate) + z(point_from_cs)

leaderboard(
  '🛡 DefCon picks  [defcon_floor = z(defcon_rate) + z(clean-sheet pts)]',
  'defcon_floor',
  false,
  [
    { label: 'DefCon',   fn: i => fmtS(num('defcon_floor')[i]!) },
    { label: 'DefRt',    fn: i => fmt(num('defcon_rate')[i]!, 2) },
    { label: 'CSPts',    fn: i => fmt(num('point_from_cs')[i]!, 0) },
    { label: 'CBI/90',   fn: i => fmt(num('cbi90')[i]!) },
    { label: 'Price',    fn: i => '£' + fmt(num('price')[i]!, 1) },
  ],
  i => str('position')[i] === 'DEF' || str('position')[i] === 'GKP',
);

// ── 6. Transfer alpha summary ─────────────────────────────────────────────────
// EO edge: z(xPts) - z(own%) → expected to score more than ownership suggests

leaderboard(
  '🚀 EO edge  [eo_edge = z(xPts_attack) − z(selected_by_percent)]',
  'eo_edge',
  false,
  [
    { label: 'EOEdge',   fn: i => fmtS(num('eo_edge')[i]!) },
    { label: 'xPts',     fn: i => fmt(num('xpts_attack')[i]!, 1) },
    { label: 'Own%',     fn: i => fmt(num('selected_by_percent')[i]!) + '%' },
    { label: 'TxIn',     fn: i => (num('net_tx')[i]! > 0 ? '+' : '') + Math.round(num('net_tx')[i]!) },
    { label: 'RisePr',   fn: i => fmt(num('rise_pressure')[i]!, 2) },
  ],
);

console.log('\n' + '─'.repeat(70));
console.log('Data: vendored 15-player sample panel (offline, approx 2025-26 FPL season)');
console.log('Run `npm run snapshot` to use the full 841-player bootstrap snapshot.');
