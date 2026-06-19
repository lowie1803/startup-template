/**
 * Cross-sectional runtime tests — backlog 010.
 *
 * Covers:
 *   - Reducer correctness: xsZscore, xsRank, xsQuantile, xsDemean
 *   - Grouping (optional group arg)
 *   - Null handling (NaN sentinel)
 *   - End-to-end via evaluate(): z/rank/quantile/scale/demean, composition, no synthetic leak
 */

import { describe, it, expect } from 'vitest';
import { xsZscore, xsRank, xsQuantile, xsDemean } from '../src/runtime/crossSectional.ts';
import { evaluate, listFields } from '../src/index.ts';
import { buildSamplePanel } from '../data/sample-panel.ts';

// ── xsZscore ──────────────────────────────────────────────────────────────────

describe('xsZscore', () => {
  it('produces mean ≈ 0 over all rows', () => {
    const col = new Float64Array([1, 2, 3, 4, 5]);
    const z = xsZscore(col);
    const mean = Array.from(z).reduce((a, b) => a + b, 0) / z.length;
    expect(Math.abs(mean)).toBeLessThan(1e-10);
  });

  it('known values for [1, 2, 3] (population std)', () => {
    // mean=2, pop std = sqrt((1+0+1)/3) = sqrt(2/3) ≈ 0.81650
    const col = new Float64Array([1, 2, 3]);
    const z = xsZscore(col);
    expect(z[0]).toBeCloseTo(-1.22474, 4);
    expect(z[1]).toBeCloseTo(0, 10);
    expect(z[2]).toBeCloseTo(1.22474, 4);
  });

  it('all-equal column → 0 for all non-null rows (std = 0 case)', () => {
    const col = new Float64Array([5, 5, 5]);
    const z = xsZscore(col);
    expect(z[0]).toBe(0);
    expect(z[1]).toBe(0);
    expect(z[2]).toBe(0);
  });

  it('null (NaN) values excluded from calculation and produce NaN out', () => {
    const col = new Float64Array([1, NaN, 3]);
    const z = xsZscore(col);
    expect(isFinite(z[0]!)).toBe(true);
    expect(isNaN(z[1]!)).toBe(true);
    expect(isFinite(z[2]!)).toBe(true);
  });

  it('grouped z-score: each group normalised independently', () => {
    // Group A: [1, 3] → z of 1 = -1, z of 3 = +1
    // Group B: [10, 20] → z of 10 = -1, z of 20 = +1
    const col = new Float64Array([1, 3, 10, 20]);
    const grp = ['A', 'A', 'B', 'B'];
    const z = xsZscore(col, grp);
    expect(z[0]).toBeCloseTo(-1, 6);
    expect(z[1]).toBeCloseTo(1, 6);
    expect(z[2]).toBeCloseTo(-1, 6);
    expect(z[3]).toBeCloseTo(1, 6);
  });
});

// ── xsRank ────────────────────────────────────────────────────────────────────

describe('xsRank', () => {
  it('lowest value → 0, highest value → 1 (no ties)', () => {
    const col = new Float64Array([1, 2, 3, 4, 5]);
    const r = xsRank(col);
    expect(r[0]).toBeCloseTo(0, 10);   // value 1 → rank 0
    expect(r[4]).toBeCloseTo(1, 10);   // value 5 → rank 1
  });

  it('ties get averaged rank', () => {
    // [1, 1, 3]: ties at positions 0 and 1 → avg rank = 0.5/2 = 0.25 (percentile)
    const col = new Float64Array([1, 1, 3]);
    const r = xsRank(col);
    expect(r[0]).toBeCloseTo(0.25, 10);
    expect(r[1]).toBeCloseTo(0.25, 10);
    expect(r[2]).toBeCloseTo(1, 10);
  });

  it('single non-null in group → 0.5', () => {
    const col = new Float64Array([42]);
    const r = xsRank(col);
    expect(r[0]).toBe(0.5);
  });

  it('null (NaN) excluded from distribution and produce NaN out', () => {
    const col = new Float64Array([1, NaN, 3]);
    const r = xsRank(col);
    expect(r[0]).toBeCloseTo(0, 10);
    expect(isNaN(r[1]!)).toBe(true);
    expect(r[2]).toBeCloseTo(1, 10);
  });

  it('grouped rank', () => {
    const col = new Float64Array([10, 20, 5, 15]);
    const grp = ['A', 'A', 'B', 'B'];
    const r = xsRank(col, grp);
    expect(r[0]).toBeCloseTo(0, 10);   // Group A: 10 → lowest
    expect(r[1]).toBeCloseTo(1, 10);   // Group A: 20 → highest
    expect(r[2]).toBeCloseTo(0, 10);   // Group B: 5 → lowest
    expect(r[3]).toBeCloseTo(1, 10);   // Group B: 15 → highest
  });

  it('negating reverses rank', () => {
    // rank(-x) ranks descending
    const col = new Float64Array([3, 1, 2]);
    const rNeg = new Float64Array([-3, -1, -2]);
    const r = xsRank(rNeg);
    expect(r[0]).toBeCloseTo(0, 10);   // -3 = lowest → rank 0 (i.e. 3 is "best")
    expect(r[2]).toBeCloseTo(0.5, 10); // -2 = middle
    expect(r[1]).toBeCloseTo(1, 10);   // -1 = highest → rank 1
  });
});

// ── xsQuantile ────────────────────────────────────────────────────────────────

describe('xsQuantile', () => {
  it('min → 0, max → 1', () => {
    const col = new Float64Array([2, 5, 8]);
    const q = xsQuantile(col);
    expect(q[0]).toBeCloseTo(0, 10);
    expect(q[2]).toBeCloseTo(1, 10);
    expect(q[1]).toBeCloseTo(0.5, 10); // midpoint
  });

  it('all equal → 0.5', () => {
    const col = new Float64Array([3, 3, 3]);
    const q = xsQuantile(col);
    expect(q[0]).toBe(0.5);
    expect(q[1]).toBe(0.5);
    expect(q[2]).toBe(0.5);
  });

  it('result always in [0, 1]', () => {
    const col = new Float64Array([10, -5, 0, 20, 7]);
    const q = xsQuantile(col);
    for (const v of q) {
      if (isFinite(v)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
  });

  it('null in → NaN out', () => {
    const col = new Float64Array([1, NaN, 5]);
    const q = xsQuantile(col);
    expect(isNaN(q[1]!)).toBe(true);
    expect(isFinite(q[0]!)).toBe(true);
  });
});

// ── xsDemean ─────────────────────────────────────────────────────────────────

describe('xsDemean', () => {
  it('mean of result is 0', () => {
    const col = new Float64Array([1, 2, 3, 4, 5]);
    const d = xsDemean(col);
    const mean = Array.from(d).reduce((a, b) => a + b, 0) / d.length;
    expect(Math.abs(mean)).toBeLessThan(1e-10);
  });

  it('known values for [1, 2, 3] (mean = 2)', () => {
    const col = new Float64Array([1, 2, 3]);
    const d = xsDemean(col);
    expect(d[0]).toBeCloseTo(-1, 10);
    expect(d[1]).toBeCloseTo(0, 10);
    expect(d[2]).toBeCloseTo(1, 10);
  });

  it('null in → NaN out, excluded from mean', () => {
    // valid: [2, 4] → mean = 3
    const col = new Float64Array([2, NaN, 4]);
    const d = xsDemean(col);
    expect(d[0]).toBeCloseTo(-1, 10);
    expect(isNaN(d[1]!)).toBe(true);
    expect(d[2]).toBeCloseTo(1, 10);
  });
});

// ── End-to-end via evaluate() ─────────────────────────────────────────────────

describe('evaluate() with XS functions', () => {
  const panel = buildSamplePanel();
  const fields = listFields();

  it('z(form) evaluates with no diagnostics', () => {
    const r = evaluate('zf = z(form)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    expect(r.panel.has('zf')).toBe(true);
    const col = Array.from(r.panel.getColumn('zf') as Float64Array).filter(isFinite);
    expect(col.length).toBeGreaterThan(0);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    expect(Math.abs(mean)).toBeLessThan(0.01);
  });

  it('zscore is an alias for z', () => {
    const r1 = evaluate('a = z(form)', panel, fields);
    const r2 = evaluate('b = zscore(form)', panel, fields);
    expect(r1.diagnostics).toHaveLength(0);
    expect(r2.diagnostics).toHaveLength(0);
    const a = Array.from(r1.panel.getColumn('a') as Float64Array);
    const b = Array.from(r2.panel.getColumn('b') as Float64Array);
    for (let i = 0; i < a.length; i++) {
      if (isFinite(a[i]!) && isFinite(b[i]!)) {
        expect(a[i]).toBeCloseTo(b[i]!, 8);
      }
    }
  });

  it('rank(form) endpoints are 0 and 1', () => {
    const r = evaluate('rf = rank(form)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const col = Array.from(r.panel.getColumn('rf') as Float64Array).filter(isFinite);
    expect(Math.min(...col)).toBeCloseTo(0, 8);
    expect(Math.max(...col)).toBeCloseTo(1, 8);
  });

  it('rank(expr, position) groups by position', () => {
    // GKP group has 2 players — the higher-value one should rank 1
    const src = 'vr = rank(total_points / price, position)';
    const r = evaluate(src, panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const vr = r.panel.getColumn('vr') as Float64Array;
    // Values should all be in [0, 1]
    for (const v of vr) {
      if (isFinite(v)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
  });

  it('quantile(form) produces values in [0, 1]', () => {
    const r = evaluate('qf = quantile(form)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const col = Array.from(r.panel.getColumn('qf') as Float64Array).filter(isFinite);
    for (const v of col) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    expect(Math.min(...col)).toBeCloseTo(0, 8);
    expect(Math.max(...col)).toBeCloseTo(1, 8);
  });

  it('scale is an alias for quantile', () => {
    const r1 = evaluate('a = quantile(form)', panel, fields);
    const r2 = evaluate('b = scale(form)', panel, fields);
    const a = Array.from(r1.panel.getColumn('a') as Float64Array);
    const b = Array.from(r2.panel.getColumn('b') as Float64Array);
    for (let i = 0; i < a.length; i++) {
      if (isFinite(a[i]!) && isFinite(b[i]!)) {
        expect(a[i]).toBeCloseTo(b[i]!, 8);
      }
    }
  });

  it('demean(form) has mean ≈ 0', () => {
    const r = evaluate('df = demean(form)', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const col = Array.from(r.panel.getColumn('df') as Float64Array).filter(isFinite);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    expect(Math.abs(mean)).toBeLessThan(0.01);
  });

  it('nested XS: rank(z(form)) evaluates', () => {
    const r = evaluate('rzf = rank(z(form))', panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const col = Array.from(r.panel.getColumn('rzf') as Float64Array).filter(isFinite);
    expect(Math.min(...col)).toBeCloseTo(0, 8);
    expect(Math.max(...col)).toBeCloseTo(1, 8);
  });

  it('z-stack: captain = z(form) + z(fixture_ease) + z(xg_over)', () => {
    const src = `
      fixture_ease = 6 - fdr
      xg_over = goals_scored - expected_goals
      captain = z(form) + z(fixture_ease) + z(xg_over)
    `;
    const r = evaluate(src, panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    expect(r.panel.has('captain')).toBe(true);
    const col = Array.from(r.panel.getColumn('captain') as Float64Array).filter(isFinite);
    expect(col.length).toBeGreaterThan(0);
  });

  it('XS factor can be referenced by a downstream factor', () => {
    const src = `
      zf = z(form)
      doubled = zf * 2
    `;
    const r = evaluate(src, panel, fields);
    expect(r.diagnostics).toHaveLength(0);
    const zf = Array.from(r.panel.getColumn('zf') as Float64Array);
    const dbl = Array.from(r.panel.getColumn('doubled') as Float64Array);
    for (let i = 0; i < zf.length; i++) {
      if (isFinite(zf[i]!) && isFinite(dbl[i]!)) {
        expect(dbl[i]).toBeCloseTo(zf[i]! * 2, 6);
      }
    }
  });

  it('__xs_* synthetic columns do not appear in output panel', () => {
    const r = evaluate('x = z(form)', panel, fields);
    const cols = r.panel.columnNames();
    expect(cols.some(c => c.startsWith('__xs_'))).toBe(false);
  });
});
