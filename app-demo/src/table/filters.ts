/**
 * Filter presets for the player table.
 *
 * Each preset defines a predicate over the evaluated Panel that returns
 * the Set of row indices to show. "All players" returns null (no filtering).
 * Presets are mutually exclusive — one active at a time.
 *
 * Position-relative presets (Star, Top GK/DEF/MID/FWD) compute a per-position
 * total_points percentile threshold from the Panel at runtime.
 */

import type { Panel } from 'fplang';

export interface FilterPreset {
  id: string;
  label: string;
  /** Returns visible row indices, or null for "show all". */
  apply(panel: Panel): Set<number> | null;
}

// ── Percentile helper ─────────────────────────────────────────────────────────

/**
 * Returns the value at the given percentile (0–1) for a numeric column,
 * optionally filtered to rows where `groupCol === groupVal`.
 * e.g. percentile(panel, 'total_points', 0.9, 'position', 'MID')
 */
function percentile(
  panel: Panel,
  col: string,
  pct: number,
  groupCol?: string,
  groupVal?: string,
): number {
  const values: number[] = [];
  for (let i = 0; i < panel.rowCount; i++) {
    if (groupCol && groupVal) {
      const g = panel.getValue(groupCol, i);
      if (g !== groupVal) continue;
    }
    const v = panel.getValue(col, i);
    if (typeof v === 'number') values.push(v);
  }
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const idx = Math.floor(pct * values.length);
  return values[Math.min(idx, values.length - 1)] ?? 0;
}

// ── Preset definitions ────────────────────────────────────────────────────────

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'all',
    label: 'All players',
    apply: () => null,
  },
  {
    id: 'active',
    label: 'Active only',
    apply(panel) {
      const rows = new Set<number>();
      for (let i = 0; i < panel.rowCount; i++) {
        const cop = panel.getValue('chance_of_playing_next_round', i);
        if (cop === null || (typeof cop === 'number' && cop >= 75)) rows.add(i);
      }
      return rows;
    },
  },
  {
    id: 'started',
    label: 'Started regularly',
    apply(panel) {
      const rows = new Set<number>();
      for (let i = 0; i < panel.rowCount; i++) {
        const starts  = panel.getValue('starts', i);
        const minutes = panel.getValue('minutes', i);
        if (
          typeof starts === 'number' && starts > 0 &&
          typeof minutes === 'number' && minutes / starts > 67.5
        ) rows.add(i);
      }
      return rows;
    },
  },
  {
    id: 'differential',
    label: 'Differential',
    apply(panel) {
      const rows = new Set<number>();
      for (let i = 0; i < panel.rowCount; i++) {
        const sel = panel.getValue('selected_by_percent', i);
        if (typeof sel === 'number' && sel < 10) rows.add(i);
      }
      return rows;
    },
  },
  {
    id: 'budget',
    label: 'Budget options',
    apply(panel) {
      const rows = new Set<number>();
      for (let i = 0; i < panel.rowCount; i++) {
        const price = panel.getValue('price', i);
        if (typeof price === 'number' && price < 6.0) rows.add(i);
      }
      return rows;
    },
  },
  {
    id: 'star',
    label: 'Star players',
    apply(panel) {
      // Top 10% by total_points within each position
      const positions = ['GKP', 'DEF', 'MID', 'FWD'];
      const thresholds = Object.fromEntries(
        positions.map(pos => [pos, percentile(panel, 'total_points', 0.9, 'position', pos)]),
      );
      const rows = new Set<number>();
      for (let i = 0; i < panel.rowCount; i++) {
        const pos = panel.getValue('position', i);
        const pts = panel.getValue('total_points', i);
        if (typeof pos === 'string' && typeof pts === 'number') {
          const threshold = thresholds[pos];
          if (threshold !== undefined && pts >= threshold) rows.add(i);
        }
      }
      return rows;
    },
  },
  ...(['GKP', 'DEF', 'MID', 'FWD'] as const).map(pos => ({
    id: `top_${pos.toLowerCase()}`,
    label: `Top ${pos === 'GKP' ? 'GK' : pos}`,
    apply(panel: Panel) {
      // Position filter + top 50% by total_points within position
      const threshold = percentile(panel, 'total_points', 0.5, 'position', pos);
      const rows = new Set<number>();
      for (let i = 0; i < panel.rowCount; i++) {
        const p = panel.getValue('position', i);
        const pts = panel.getValue('total_points', i);
        if (p === pos && typeof pts === 'number' && pts >= threshold) rows.add(i);
      }
      return rows;
    },
  })),
];
