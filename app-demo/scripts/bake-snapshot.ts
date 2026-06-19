/**
 * Bake the offline FPL snapshot into browser-ready JSON assets.
 *
 * Outputs:
 *   app-demo/public/panel.json   — { rowCount, columns, bakedAt }
 *   app-demo/public/fields.json  — FieldDef[] from listFields()
 *
 * Usage: tsx scripts/bake-snapshot.ts
 */

import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

// Dynamic imports so tsx resolves the repo root correctly
const { loadSnapshot } = await import('../../data/loadSnapshot.js');
const { listFields }   = await import('../../src/index.js');

mkdirSync(publicDir, { recursive: true });

// ── Panel ─────────────────────────────────────────────────────────────────────

const panel    = loadSnapshot();
const columns  = panel.toObject();

const panelJson = JSON.stringify({
  rowCount: panel.rowCount,
  columns,
  bakedAt: new Date().toISOString(),
});

writeFileSync(resolve(publicDir, 'panel.json'), panelJson, 'utf-8');
console.log(`✓ panel.json  (${panel.rowCount} players, ${Object.keys(columns).length} columns)`);

// ── Fields ────────────────────────────────────────────────────────────────────

const fields = listFields();
writeFileSync(resolve(publicDir, 'fields.json'), JSON.stringify(fields), 'utf-8');
console.log(`✓ fields.json (${fields.length} fields)`);

// ── Examples ──────────────────────────────────────────────────────────────────

const factorsDir = resolve(__dirname, '../../factors');
const exampleFiles = readdirSync(factorsDir)
  .filter(f => f.endsWith('.factors'))
  .sort();

const examples = exampleFiles.map(f => ({
  name: basename(f, '.factors'),
  text: readFileSync(resolve(factorsDir, f), 'utf-8'),
}));

writeFileSync(resolve(publicDir, 'examples.json'), JSON.stringify(examples), 'utf-8');
console.log(`✓ examples.json (${examples.length} factor libraries)`);
