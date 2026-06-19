/**
 * Domain lookup + scalar-gap tests — backlog 018 + clamp/isnull/notnull/exp.
 *
 * Tests goal_points(position), cs_points(position), assist_points constant,
 * and the newly-added scalar builtins via evaluateFactors.
 */

import { describe, it, expect } from 'vitest';
import { evaluate, listFields } from '../src/index.ts';
import { buildSamplePanel } from '../data/sample-panel.ts';

const panel = buildSamplePanel();
const fields = listFields();

// ── FPL scoring domain lookups ────────────────────────────────────────────────

describe('goal_points(position)', () => {
  it('GKP/DEF = 6, MID = 5, FWD = 4', () => {
    const r = evaluate('gp = goal_points(position)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const gp  = r.panel.getColumn('gp')  as Float64Array;
    const pos = r.panel.getColumn('position') as string[];
    for (let i = 0; i < panel.rowCount; i++) {
      if (pos[i] === 'GKP' || pos[i] === 'DEF') expect(gp[i]).toBe(6);
      if (pos[i] === 'MID') expect(gp[i]).toBe(5);
      if (pos[i] === 'FWD') expect(gp[i]).toBe(4);
    }
  });
});

describe('cs_points(position)', () => {
  it('GKP/DEF = 4, MID = 1, FWD = 0', () => {
    const r = evaluate('cs = cs_points(position)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const cs  = r.panel.getColumn('cs')  as Float64Array;
    const pos = r.panel.getColumn('position') as string[];
    for (let i = 0; i < panel.rowCount; i++) {
      if (pos[i] === 'GKP' || pos[i] === 'DEF') expect(cs[i]).toBe(4);
      if (pos[i] === 'MID') expect(cs[i]).toBe(1);
      if (pos[i] === 'FWD') expect(cs[i]).toBe(0);
    }
  });
});

describe('assist_points constant', () => {
  it('resolves to 3 everywhere', () => {
    const r = evaluate('ap = assist_points', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const ap = r.panel.getColumn('ap') as Float64Array;
    for (const v of ap) expect(v).toBe(3);
  });

  it('can be used in arithmetic: assists * assist_points', () => {
    const r = evaluate('pa = assists * assist_points', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const pa  = r.panel.getColumn('pa')  as Float64Array;
    const ast = r.panel.getColumn('assists') as Float64Array;
    for (let i = 0; i < panel.rowCount; i++) {
      if (isFinite(ast[i]!)) expect(pa[i]).toBeCloseTo(ast[i]! * 3, 6);
    }
  });
});

describe('expected-points decomposition', () => {
  it('xpts_attack = xG * goal_points + xA * assist_points evaluates', () => {
    const src = `
      xpts_attack = expected_goals * goal_points(position) + expected_assists * assist_points
    `;
    const r = evaluate(src, panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const xpts = r.panel.getColumn('xpts_attack') as Float64Array;
    // Salah (MID): xG=19.8, xA=14.2 → 19.8*5 + 14.2*3 = 99 + 42.6 = 141.6
    // Find the MID player with the highest xG (Salah, id=6, row index 5)
    const pos = r.panel.getColumn('position') as string[];
    const xg  = r.panel.getColumn('expected_goals') as Float64Array;
    for (let i = 0; i < panel.rowCount; i++) {
      if (pos[i] === 'MID') {
        const expected = xg[i]! * 5 + (r.panel.getColumn('expected_assists') as Float64Array)[i]! * 3;
        expect(xpts[i]).toBeCloseTo(expected, 4);
      }
    }
  });
});

// ── Scalar additions ──────────────────────────────────────────────────────────

describe('clamp(x, lo, hi)', () => {
  it('clamps within range', () => {
    const r = evaluate('cf = clamp(form, 3, 8)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const col = r.panel.getColumn('cf') as Float64Array;
    for (const v of col) {
      if (isFinite(v)) { expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(8); }
    }
  });

  it('value within range → unchanged', () => {
    const r = evaluate('cf = clamp(form, 0, 100)', panel, fields);
    const cf   = r.panel.getColumn('cf')   as Float64Array;
    const form = r.panel.getColumn('form') as Float64Array;
    for (let i = 0; i < panel.rowCount; i++) {
      expect(cf[i]).toBeCloseTo(form[i]!, 6);
    }
  });
});

describe('isnull(x)', () => {
  it('returns 0 for non-null values', () => {
    const r = evaluate('in = isnull(form)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const col = r.panel.getColumn('in') as Float64Array;
    // form is always populated in sample panel
    for (const v of col) expect(v).toBe(0);
  });
});

describe('notnull(x)', () => {
  it('returns 1 for non-null values', () => {
    const r = evaluate('nn = notnull(form)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const col = r.panel.getColumn('nn') as Float64Array;
    for (const v of col) expect(v).toBe(1);
  });
});

describe('exp(x)', () => {
  it('exp(0) = 1', () => {
    const r = evaluate('e0 = exp(0)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const col = r.panel.getColumn('e0') as Float64Array;
    for (const v of col) expect(v).toBeCloseTo(1, 10);
  });

  it('exp(1) ≈ 2.71828', () => {
    const r = evaluate('e1 = exp(1)', panel, fields);
    const col = r.panel.getColumn('e1') as Float64Array;
    for (const v of col) expect(v).toBeCloseTo(Math.E, 6);
  });
});
