/**
 * Columnar Panel loader from the offline FPL snapshot.
 * Implements backlog item 015.
 *
 * Reads `datasets/fpl-<season>/raw/bootstrap-static.json` and returns a Panel
 * with the same column shape that buildSamplePanel() produces — so the REPL,
 * run.ts, and tests can swap sample ↔ snapshot transparently.
 *
 * Known gap: fixture-derived fields (fdr) are not in bootstrap-static.json.
 * Those columns are filled with NaN (Panel treats NaN as null) until a
 * fixture-loader is added.
 *
 * Usage:
 *   import { loadSnapshot } from '../data/loadSnapshot.js';
 *   const panel = loadSnapshot();              // 2025-26 season, default path
 *   const panel = loadSnapshot({ season: '2024-25' });
 */

import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Panel } from '../src/runtime/panel.js';
import { FPL_FIELDS } from '../src/catalog/fields.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ── Bootstrap JSON shape (relevant fields only) ───────────────────────────────

interface BootstrapTeam {
  id: number;
  short_name: string;
}

interface BootstrapElementType {
  id: number;       // 1=GKP, 2=DEF, 3=MID, 4=FWD
  singular_name_short: string; // "GKP", "DEF", "MID", "FWD"
}

interface BootstrapElement {
  id: number;
  web_name: string;
  element_type: number;          // maps to position via element_types
  team: number;                  // team id — maps to short_name via teams[]
  now_cost: number;              // integer; divide by 10 for £m price
  [key: string]: unknown;        // many other fields
}

interface BootstrapStatic {
  teams: BootstrapTeam[];
  element_types: BootstrapElementType[];
  elements: BootstrapElement[];
}

// ── Fields that need special derivation (not a direct bootstrap key lookup) ───

const DERIVED_FIELDS = new Set(['price', 'position', 'team', 'web_name', 'id']);

/**
 * Fields that exist in the FPL_FIELDS catalog but are not present in
 * bootstrap-static.json (e.g. fixture-derived). Filled with NaN.
 */
const FIXTURE_DERIVED_FIELDS = new Set(['fdr']);

// ── Loader ────────────────────────────────────────────────────────────────────

export interface LoadSnapshotOptions {
  /** Season string, e.g. '2025-26'. Default: '2025-26'. */
  season?: string;
  /**
   * Absolute path to the `raw/` directory. Overrides the default
   * `<repo>/datasets/fpl-<season>/raw/`.
   */
  rawDir?: string;
}

/**
 * Load the offline FPL bootstrap snapshot and return a columnar Panel.
 *
 * Column types follow the FPL_FIELDS catalog:
 *   - type: 'number' → Float64Array (NaN for missing/null values)
 *   - type: 'string' → string[]
 *   - type: 'bool'   → Float64Array (true→1, false→0, null→NaN)
 */
export function loadSnapshot(opts: LoadSnapshotOptions = {}): Panel {
  const season = opts.season ?? '2025-26';
  const rawDir = opts.rawDir ?? join(REPO_ROOT, 'datasets', `fpl-${season}`, 'raw');

  const bootstrapPath = join(rawDir, 'bootstrap-static.json');
  const raw: BootstrapStatic = JSON.parse(readFileSync(bootstrapPath, 'utf-8'));

  const { elements, teams, element_types } = raw;
  const n = elements.length;

  // Build lookup tables
  const teamById = new Map<number, string>(teams.map(t => [t.id, t.short_name]));
  const posById  = new Map<number, string>(element_types.map(et => [et.id, et.singular_name_short]));

  // Build columns
  const init: Record<string, Float64Array | string[]> = {};

  for (const field of FPL_FIELDS) {
    if (field.type === 'string') {
      // String column
      const col: string[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const el = elements[i]!;
        col[i] = deriveString(field.name, el, teamById, posById);
      }
      init[field.name] = col;
    } else {
      // Numeric column (includes bool → 0/1)
      const col = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        col[i] = deriveNumber(field.name, elements[i]!, field.type === 'bool');
      }
      init[field.name] = col;
    }
  }

  return new Panel(n, init);
}

// ── Derivation helpers ────────────────────────────────────────────────────────

function deriveString(
  fieldName: string,
  el: BootstrapElement,
  teamById: Map<number, string>,
  posById:  Map<number, string>,
): string {
  switch (fieldName) {
    case 'web_name': return String(el.web_name ?? '');
    case 'position': return posById.get(el.element_type) ?? '';
    case 'team':     return teamById.get(el.team) ?? '';
    default:         return String(el[fieldName] ?? '');
  }
}

function deriveNumber(
  fieldName: string,
  el: BootstrapElement,
  isBool: boolean,
): number {
  // Fields not in bootstrap-static
  if (FIXTURE_DERIVED_FIELDS.has(fieldName)) return NaN;

  switch (fieldName) {
    case 'price': {
      const v = el.now_cost;
      return typeof v === 'number' && isFinite(v) ? v / 10 : NaN;
    }
    case 'id': {
      const v = el.id;
      return typeof v === 'number' ? v : NaN;
    }
    default: {
      const raw = el[fieldName];
      if (raw === null || raw === undefined || raw === '') return NaN;
      if (isBool) {
        if (raw === true)  return 1;
        if (raw === false) return 0;
      }
      const v = Number(raw);
      return isFinite(v) ? v : NaN;
    }
  }
}
