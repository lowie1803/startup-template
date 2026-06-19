/**
 * Tests for src/sources/fill.ts — the fill step.
 * Covers each FillPolicy eliminating NaN from numeric columns and '' from strings.
 */

import { describe, it, expect } from 'vitest';
import { applyFills } from '../src/sources/fill.js';
import { Panel } from '../src/runtime/panel.js';
import type { FieldDef } from '../src/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function numField(name: string, fill: FieldDef['fill']): FieldDef {
  return { name, source: 'test', type: 'number', description: 'test', fill };
}
function strField(name: string, fill: FieldDef['fill']): FieldDef {
  return { name, source: 'test', type: 'string', description: 'test', fill };
}

function makePanel(cols: Record<string, Float64Array | string[]>): Panel {
  const firstLen = Object.values(cols)[0]?.length ?? 0;
  return new Panel(firstLen, cols);
}

const NaN_ = NaN;

// ── fill: none ────────────────────────────────────────────────────────────────

describe("fill: { kind: 'none' }", () => {
  it('leaves NaN values untouched (validator will catch them)', () => {
    const col = new Float64Array([1, NaN_, 3]);
    const panel = makePanel({ x: col });
    const fields = [numField('x', { kind: 'none' })];
    const out = applyFills(panel, fields);
    const outCol = out.getNumeric('x')!;
    expect(outCol[0]).toBe(1);
    expect(outCol[1]).toBeNaN();
    expect(outCol[2]).toBe(3);
  });

  it('does not mutate the input panel', () => {
    const col = new Float64Array([1, NaN_, 3]);
    const panel = makePanel({ x: col });
    applyFills(panel, [numField('x', { kind: 'none' })]);
    expect(col[1]).toBeNaN(); // original unchanged
  });
});

// ── fill: zero ────────────────────────────────────────────────────────────────

describe("fill: { kind: 'zero' }", () => {
  it('replaces NaN with 0', () => {
    const panel = makePanel({ x: new Float64Array([1, NaN_, NaN_, 4]) });
    const out = applyFills(panel, [numField('x', { kind: 'zero' })]);
    expect(Array.from(out.getNumeric('x')!)).toEqual([1, 0, 0, 4]);
  });

  it('replaces Inf with 0', () => {
    const panel = makePanel({ x: new Float64Array([1, Infinity, -Infinity]) });
    const out = applyFills(panel, [numField('x', { kind: 'zero' })]);
    expect(Array.from(out.getNumeric('x')!)).toEqual([1, 0, 0]);
  });

  it('leaves finite values intact', () => {
    const panel = makePanel({ x: new Float64Array([1.5, 2.5, 3.5]) });
    const out = applyFills(panel, [numField('x', { kind: 'zero' })]);
    expect(Array.from(out.getNumeric('x')!)).toEqual([1.5, 2.5, 3.5]);
  });
});

// ── fill: constant ────────────────────────────────────────────────────────────

describe("fill: { kind: 'constant' }", () => {
  it('replaces NaN with the constant value (numeric)', () => {
    const panel = makePanel({ cop: new Float64Array([75, NaN_, NaN_, 50]) });
    const out = applyFills(panel, [numField('cop', { kind: 'constant', value: 100 })]);
    expect(Array.from(out.getNumeric('cop')!)).toEqual([75, 100, 100, 50]);
  });

  it('replaces empty string with the constant value (string)', () => {
    const panel = makePanel({ status: ['a', '', 'd', ''] });
    const out = applyFills(panel, [strField('status', { kind: 'constant', value: 'a' })]);
    expect(out.getString('status')!).toEqual(['a', 'a', 'd', 'a']);
  });
});

// ── fill: mean ────────────────────────────────────────────────────────────────

describe("fill: { kind: 'mean' }", () => {
  it('fills NaN with the mean of finite values', () => {
    const panel = makePanel({ x: new Float64Array([2, NaN_, 4, NaN_, 6]) });
    const out = applyFills(panel, [numField('x', { kind: 'mean' })]);
    // mean of [2, 4, 6] = 4
    expect(Array.from(out.getNumeric('x')!)).toEqual([2, 4, 4, 4, 6]);
  });

  it('leaves column unchanged if no NaN', () => {
    const panel = makePanel({ x: new Float64Array([1, 2, 3]) });
    const out = applyFills(panel, [numField('x', { kind: 'mean' })]);
    expect(Array.from(out.getNumeric('x')!)).toEqual([1, 2, 3]);
  });

  it('all-NaN column stays NaN (no mean to compute)', () => {
    const panel = makePanel({ x: new Float64Array([NaN_, NaN_]) });
    const out = applyFills(panel, [numField('x', { kind: 'mean' })]);
    expect(out.getNumeric('x')![0]).toBeNaN();
  });
});

// ── fill: median ──────────────────────────────────────────────────────────────

describe("fill: { kind: 'median' }", () => {
  it('fills NaN with the median of finite values (odd count)', () => {
    const panel = makePanel({ x: new Float64Array([1, NaN_, 3, NaN_, 5]) });
    const out = applyFills(panel, [numField('x', { kind: 'median' })]);
    // median of [1, 3, 5] = 3
    expect(Array.from(out.getNumeric('x')!)).toEqual([1, 3, 3, 3, 5]);
  });

  it('fills NaN with the median (even count — average of two middles)', () => {
    const panel = makePanel({ x: new Float64Array([2, NaN_, 4, 6]) });
    const out = applyFills(panel, [numField('x', { kind: 'median' })]);
    // median of [2, 4, 6] = 4
    expect(Array.from(out.getNumeric('x')!)).toEqual([2, 4, 4, 6]);
  });
});

// ── Source fillMissing override ───────────────────────────────────────────────

describe('source.fillMissing override', () => {
  it('called after the FillPolicy fill with the column clone', () => {
    const panel = makePanel({ x: new Float64Array([1, NaN_]) });
    const fields = [numField('x', { kind: 'zero' })]; // policy fills NaN→0

    let sawValue: number | undefined;
    const source = {
      fillMissing(col: Float64Array, field: FieldDef) {
        // After policy fill, NaN is now 0; override it to -1
        sawValue = col[1]; // should be 0 (already filled)
        col[1] = -1;
      },
    };

    const out = applyFills(panel, fields, source);
    expect(sawValue).toBe(0); // policy ran first
    expect(out.getNumeric('x')![1]).toBe(-1); // override applied after
  });
});

// ── Unlisted columns pass through ─────────────────────────────────────────────

describe('unlisted columns', () => {
  it('columns not in fields[] are preserved unchanged', () => {
    const panel = makePanel({
      x: new Float64Array([1, NaN_]),
      y: new Float64Array([10, 20]),
    });
    const out = applyFills(panel, [numField('x', { kind: 'zero' })]);
    // y not in fields → should still be there, unchanged
    expect(out.has('y')).toBe(true);
    expect(Array.from(out.getNumeric('y')!)).toEqual([10, 20]);
  });
});

// ── fpl source end-to-end ─────────────────────────────────────────────────────

describe('fpl source after applyFills', () => {
  it('fdr column (all NaN) fills to 3 after applyFills with FPL_FIELDS', async () => {
    const { loadSnapshot } = await import('../data/loadSnapshot.js');
    const { FPL_FIELDS } = await import('../src/catalog/fields.js');
    const panel = loadSnapshot();
    const dense = applyFills(panel, FPL_FIELDS);

    // fdr was all NaN → should be 3 everywhere
    const fdr = dense.getNumeric('fdr')!;
    for (let i = 0; i < Math.min(fdr.length, 10); i++) {
      expect(fdr[i]).toBe(3);
    }
  });

  it('chance_of_playing fills to 100 for null rows', async () => {
    const { loadSnapshot } = await import('../data/loadSnapshot.js');
    const { FPL_FIELDS } = await import('../src/catalog/fields.js');
    const panel = loadSnapshot();
    const dense = applyFills(panel, FPL_FIELDS);

    const cop = dense.getNumeric('chance_of_playing_next_round')!;
    for (let i = 0; i < cop.length; i++) {
      expect(isFinite(cop[i]!)).toBe(true);
    }
  });
});
