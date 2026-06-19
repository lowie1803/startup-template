/**
 * fplang data-layer demo
 *
 * Shows how to work with the DataSource / Panel stack:
 *   fplSource.load()  →  applyFills  →  validateDataset  →  mergePanels
 *
 * Uses the offline bootstrap snapshot (datasets/fpl-2025-26/raw/).
 * Run:  npx tsx examples/sources.ts
 *
 * Note: loadSnapshot() reads from disk (no network). Make sure the snapshot
 * exists — run `npm run snapshot` if datasets/fpl-2025-26/raw/ is empty.
 */

import { fplSource } from '../data/fplSource.ts';
import { applyFills } from '../src/sources/fill.ts';
import { validateDataset } from '../src/validate.ts';
import { mergePanels } from '../src/runtime/merge.ts';
import type { Panel } from '../src/runtime/panel.ts';

// ── 1. Load the built-in fpl source ──────────────────────────────────────────

console.log('Loading fpl source…');
const raw: Panel = await fplSource.load();
console.log(`  raw panel: ${raw.rowCount} players, ${raw.columnNames().length} columns\n`);

// ── 2. Apply fill policies (turn NaN / '' into valid values) ─────────────────

const filled = applyFills(raw, fplSource.fields);

// ── 3. Validate well-formedness ───────────────────────────────────────────────

const report = validateDataset(fplSource.fields, filled);

if (report.ok) {
  console.log(`✓ fpl source validates — no errors`);
} else {
  console.log(`✗ fpl source has ${report.errors.length} error(s):`);
  for (const e of report.errors) console.log(`  [${e.code}] ${e.message}`);
}

if (report.warnings.length > 0) {
  console.log(`  ${report.warnings.length} warning(s) (range violations, informational only)`);
}
console.log();

// ── 4. Peek at the top-5 rows by total_points ─────────────────────────────────

const names = filled.getColumn('web_name') as string[];
const positions = filled.getColumn('position') as string[];
const pts = filled.getColumn('total_points') as Float64Array;
const prices = filled.getColumn('price') as Float64Array;

const indices = Array.from({ length: filled.rowCount }, (_, i) => i);
indices.sort((a, b) => (pts[b] ?? 0) - (pts[a] ?? 0));

console.log('Top 5 players by total_points (from full 841-player snapshot):');
console.log('Name'.padEnd(20), 'Pos'.padEnd(4), '£'.padStart(5), 'Pts'.padStart(5));
console.log('─'.repeat(38));
for (const i of indices.slice(0, 5)) {
  console.log(
    (names[i] ?? '?').padEnd(20),
    (positions[i] ?? '?').padEnd(4),
    (prices[i] ?? 0).toFixed(1).padStart(5),
    (pts[i] ?? 0).toFixed(0).padStart(5),
  );
}
console.log();

// ── 5. mergePanels demo: synthetic second source ──────────────────────────────
//
// In a real multi-source setup you'd load a second DataSource module here.
// This demo creates a tiny toy panel to show the join-on-id mechanic.

import { Panel } from '../src/runtime/panel.ts';

// Build a mini 3-row overlay with the first 3 player ids from the fpl snapshot
const id0 = (filled.getColumn('id') as Float64Array)[0]!;
const id1 = (filled.getColumn('id') as Float64Array)[1]!;
const id2 = (filled.getColumn('id') as Float64Array)[2]!;

const overlayIds = new Float64Array([id0, id1, id2]);
const xtraScore = new Float64Array([9.1, 8.4, 7.2]);  // imaginary 3rd-party metric

const overlay = new Panel(3, { id: overlayIds, xtra_score: xtraScore });
const merged = mergePanels(filled, overlay);

console.log(`mergePanels: fpl (${filled.rowCount} rows) + overlay (3 rows) → ${merged.rowCount} rows`);
console.log(`  merged columns: ${merged.columnNames().length} (fpl columns + xtra_score)`);
console.log(`  xtra_score[0] = ${(merged.getColumn('xtra_score') as Float64Array)[0]}`);
console.log(`  xtra_score[3] = ${(merged.getColumn('xtra_score') as Float64Array)[3]} (NaN → missing row in overlay)`);
