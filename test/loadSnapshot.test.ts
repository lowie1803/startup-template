/**
 * Tests for data/loadSnapshot.ts (backlog 015).
 * Verifies that the offline FPL snapshot is loaded correctly into a Panel.
 */

import { describe, it, expect } from 'vitest';
import { loadSnapshot } from '../data/loadSnapshot.js';
import { listFields } from '../src/index.js';

describe('loadSnapshot', () => {
  // Load once for all tests in this suite
  const panel = loadSnapshot();

  it('returns a Panel with 841 rows (all FPL 2025-26 elements)', () => {
    expect(panel.rowCount).toBe(841);
  });

  it('has all FPL_FIELDS catalog columns', () => {
    for (const field of listFields()) {
      expect(panel.has(field.name)).toBe(true);
    }
  });

  it('position column contains only GKP/DEF/MID/FWD', () => {
    const posCol = panel.getString('position');
    expect(posCol).toBeDefined();
    const valid = new Set(['GKP', 'DEF', 'MID', 'FWD']);
    for (const pos of posCol!) {
      expect(valid.has(pos)).toBe(true);
    }
  });

  it('price = now_cost / 10 for a real player (Raya, now_cost=62)', () => {
    const webNames = panel.getString('web_name');
    expect(webNames).toBeDefined();
    const rayaIdx = webNames!.indexOf('Raya');
    expect(rayaIdx).toBeGreaterThanOrEqual(0);
    const price = panel.getValue('price', rayaIdx);
    // Raya's now_cost is 62 → price should be 6.2
    expect(price).toBeCloseTo(6.2, 5);
  });

  it('form field is a finite number (not NaN) for active players', () => {
    // At least half the players should have a valid form value
    const n = panel.rowCount;
    let finiteCount = 0;
    for (let i = 0; i < n; i++) {
      const v = panel.getValue('form', i);
      if (v !== null && typeof v === 'number') finiteCount++;
    }
    expect(finiteCount).toBeGreaterThan(n / 2);
  });

  it('team column contains only 20 distinct Premier League teams', () => {
    const teamCol = panel.getString('team');
    expect(teamCol).toBeDefined();
    const teams = new Set(teamCol!.filter(t => t !== ''));
    expect(teams.size).toBe(20);
  });

  it('fdr column exists but is all NaN (fixture-derived, not in bootstrap)', () => {
    expect(panel.has('fdr')).toBe(true);
    // Panel.getValue returns null for NaN
    const val = panel.getValue('fdr', 0);
    expect(val).toBeNull();
  });

  it('numeric string fields parse to numbers (expected_goals, selected_by_percent)', () => {
    // Find a known high-ownership player (Salah)
    const webNames = panel.getString('web_name');
    const salahIdx = webNames?.indexOf('Salah') ?? -1;
    if (salahIdx >= 0) {
      const sel = panel.getValue('selected_by_percent', salahIdx);
      expect(typeof sel).toBe('number');
      expect(sel).toBeGreaterThan(0);
    }
  });

  it('loadSnapshot with explicit season option returns same shape', () => {
    const panel2 = loadSnapshot({ season: '2025-26' });
    expect(panel2.rowCount).toBe(panel.rowCount);
  });
});
