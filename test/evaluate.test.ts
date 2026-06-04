import { describe, it, expect } from 'vitest';
import { Panel } from '../src/runtime/panel.js';
import { evaluateFactors } from '../src/runtime/evaluate.js';
import { FPL_FIELDS } from '../src/catalog/fields.js';
import { buildSamplePanel } from '../data/sample-panel.js';

/** Build a tiny 3-row test panel for deterministic assertions. */
function makeMiniPanel(): Panel {
  return new Panel(3, {
    total_points: new Float64Array([100, 200, 150]),
    price:        new Float64Array([10,   5,  7.5]),
    minutes:      new Float64Array([900, 1800, 1350]),
    goals_scored: new Float64Array([5,   15,  10]),
    position:     ['DEF', 'MID', 'FWD'],
    saves:        new Float64Array([0, 0, 0]),
    bonus:        new Float64Array([5, 20, 12]),
    expected_goals: new Float64Array([4.0, 12.5, 8.0]),
  });
}

describe('evaluateFactors', () => {
  it('computes a simple division factor', () => {
    const panel = makeMiniPanel();
    const { panel: out, factorNames, diagnostics } = evaluateFactors(
      'value = total_points / price', panel, FPL_FIELDS,
    );
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    expect(factorNames).toContain('value');

    const col = out.getNumeric('value');
    expect(col).toBeDefined();
    // 100/10=10, 200/5=40, 150/7.5=20
    expect(col?.[0]).toBeCloseTo(10, 5);
    expect(col?.[1]).toBeCloseTo(40, 5);
    expect(col?.[2]).toBeCloseTo(20, 5);
  });

  it('rounds results to 6 decimal places', () => {
    const panel = makeMiniPanel();
    // 1/3 = 0.333333...
    const { panel: out } = evaluateFactors('r = total_points / 300', panel, FPL_FIELDS);
    const col = out.getNumeric('r');
    expect(col?.[0]).toBe(0.333333); // 100/300 rounded to 6dp
  });

  it('null propagation: arithmetic with null operand → null (NaN sentinel)', () => {
    // Put NaN in price column to represent null
    const panel = new Panel(2, {
      total_points: new Float64Array([100, 200]),
      price:        new Float64Array([NaN, 5]),   // row 0 price is null
    });
    const { panel: out } = evaluateFactors('v = total_points / price', panel, FPL_FIELDS);
    const col = out.getNumeric('v');
    expect(isFinite(col?.[0] ?? NaN)).toBe(false); // null → NaN sentinel
    expect(col?.[1]).toBeCloseTo(40, 5);
  });

  it('div/0 → null (NaN sentinel)', () => {
    const panel = new Panel(1, {
      total_points: new Float64Array([100]),
      price:        new Float64Array([0]),
    });
    const { panel: out } = evaluateFactors('v = total_points / price', panel, FPL_FIELDS);
    const col = out.getNumeric('v');
    expect(isFinite(col?.[0] ?? NaN)).toBe(false);
  });

  it('iff() — numeric condition', () => {
    const panel = makeMiniPanel();
    const { panel: out } = evaluateFactors(
      'nailed = iff(minutes > 1500, 1, 0)', panel, FPL_FIELDS,
    );
    const col = out.getNumeric('nailed');
    expect(col?.[0]).toBe(0); // 900 < 1500
    expect(col?.[1]).toBe(1); // 1800 > 1500
    expect(col?.[2]).toBe(0); // 1350 < 1500
  });

  it('iff() — string equality condition', () => {
    const panel = makeMiniPanel();
    const { panel: out } = evaluateFactors(
      'saves_pts = iff(position == "DEF", 1, 0)', panel, FPL_FIELDS,
    );
    const col = out.getNumeric('saves_pts');
    expect(col?.[0]).toBe(1); // DEF
    expect(col?.[1]).toBe(0); // MID
    expect(col?.[2]).toBe(0); // FWD
  });

  it('per90() builtin', () => {
    const panel = makeMiniPanel();
    const { panel: out } = evaluateFactors(
      'ppg90 = per90(total_points, minutes)', panel, FPL_FIELDS,
    );
    const col = out.getNumeric('ppg90');
    // 100/900*90 = 10
    expect(col?.[0]).toBeCloseTo(10, 4);
    // 200/1800*90 = 10
    expect(col?.[1]).toBeCloseTo(10, 4);
  });

  it('later factors can reference earlier ones', () => {
    const panel = makeMiniPanel();
    const text = 'raw = total_points / price\nrank_proxy = raw * 2';
    const { panel: out, diagnostics } = evaluateFactors(text, panel, FPL_FIELDS);
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

    const raw = out.getNumeric('raw');
    const rank_proxy = out.getNumeric('rank_proxy');
    expect(rank_proxy?.[0]).toBeCloseTo((raw?.[0] ?? NaN) * 2, 5);
  });

  it('unary minus', () => {
    const panel = makeMiniPanel();
    const { panel: out } = evaluateFactors('neg = -total_points', panel, FPL_FIELDS);
    const col = out.getNumeric('neg');
    expect(col?.[0]).toBe(-100);
    expect(col?.[1]).toBe(-200);
  });

  it('coalesce() returns first non-null', () => {
    const panel = new Panel(2, {
      chance_of_playing_next_round: new Float64Array([NaN, 75]),
    });
    const { panel: out } = evaluateFactors(
      'avail = coalesce(chance_of_playing_next_round, 100) / 100',
      panel,
      FPL_FIELDS,
    );
    const col = out.getNumeric('avail');
    expect(col?.[0]).toBeCloseTo(1.0, 5); // NaN → coalesce to 100 → /100 = 1.0
    expect(col?.[1]).toBeCloseTo(0.75, 5);
  });

  it('string equality returns 1 or 0', () => {
    const panel = makeMiniPanel();
    const { panel: out } = evaluateFactors(
      'is_mid = iff(position == "MID", 1, 0)', panel, FPL_FIELDS,
    );
    const col = out.getNumeric('is_mid');
    expect(col?.[0]).toBe(0);
    expect(col?.[1]).toBe(1);
    expect(col?.[2]).toBe(0);
  });

  it('unknown column name emits an error diagnostic', () => {
    const panel = makeMiniPanel();
    const { diagnostics } = evaluateFactors('v = nonexistent_col / price', panel, FPL_FIELDS);
    expect(diagnostics.some(d => d.severity === 'error')).toBe(true);
  });

  it('works with the sample panel', () => {
    const panel = buildSamplePanel();
    const { panel: out, factorNames, diagnostics } = evaluateFactors(
      'value = total_points / price\nnailed = iff(minutes > 1500, 1, 0)',
      panel,
      FPL_FIELDS,
    );
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    expect(factorNames).toEqual(['value', 'nailed']);
    expect(out.rowCount).toBe(panel.rowCount);

    // Salah: 278 / 13.5 ≈ 20.59
    // Haaland: 222 / 14.5 ≈ 15.31
    // Find Salah in the name column
    const names = panel.getString('web_name');
    const salahIdx = names?.indexOf('Salah') ?? -1;
    expect(salahIdx).toBeGreaterThanOrEqual(0);
    const val = out.getNumeric('value')?.[salahIdx];
    expect(val).toBeCloseTo(278 / 13.5, 4);
  });

  it('empty text returns empty factorNames with no diagnostics', () => {
    const panel = makeMiniPanel();
    const { factorNames, diagnostics } = evaluateFactors('', panel, FPL_FIELDS);
    expect(factorNames).toHaveLength(0);
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('parses and ignores comment-only lines', () => {
    const panel = makeMiniPanel();
    const { factorNames, diagnostics } = evaluateFactors(
      '# just a comment\nv = total_points / price', panel, FPL_FIELDS,
    );
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    expect(factorNames).toContain('v');
  });
});
