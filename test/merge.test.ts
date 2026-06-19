/**
 * Tests for src/runtime/merge.ts — backlog item 022.
 * Also includes a smoke test for fplSource (backlog item 023).
 */

import { describe, it, expect } from 'vitest';
import { Panel } from '../src/runtime/panel.js';
import { mergePanels } from '../src/runtime/merge.js';
import { fplSource } from '../data/fplSource.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBase(ids: number[], extraCols?: Record<string, Float64Array | string[]>): Panel {
  const idCol = new Float64Array(ids);
  return new Panel(ids.length, { id: idCol, ...extraCols });
}

function makeSource(
  ids: number[],
  cols: Record<string, Float64Array | string[]>,
): Panel {
  const idCol = new Float64Array(ids);
  return new Panel(ids.length, { id: idCol, ...cols });
}

// ── mergePanels tests ─────────────────────────────────────────────────────────

describe('mergePanels', () => {
  it('merges numeric columns from source onto base (matching ids)', () => {
    const base   = makeBase([1, 2, 3]);
    const source = makeSource([1, 2, 3], { xg: new Float64Array([0.5, 1.2, 0.3]) });

    const result = mergePanels(base, source);
    expect(result.rowCount).toBe(3);
    expect(result.has('xg')).toBe(true);
    expect(result.getNumeric('xg')).toEqual(new Float64Array([0.5, 1.2, 0.3]));
  });

  it('merges string columns from source onto base', () => {
    const base   = makeBase([10, 20]);
    const source = makeSource([10, 20], { team: ['LIV', 'ARS'] });

    const result = mergePanels(base, source);
    expect(result.getString('team')).toEqual(['LIV', 'ARS']);
  });

  it('fills NaN for base rows with no match in numeric source column', () => {
    const base   = makeBase([1, 2, 3]);
    // Source only covers ids 1 and 3
    const source = makeSource([1, 3], { xg: new Float64Array([0.5, 0.3]) });

    const result = mergePanels(base, source);
    const xg = result.getNumeric('xg')!;
    expect(xg[0]).toBeCloseTo(0.5);
    expect(xg[1]).toBeNaN();
    expect(xg[2]).toBeCloseTo(0.3);
  });

  it("fills '' for base rows with no match in string source column", () => {
    const base   = makeBase([1, 2, 3]);
    const source = makeSource([1, 3], { team: ['LIV', 'ARS'] });

    const result = mergePanels(base, source);
    const team = result.getString('team')!;
    expect(team[0]).toBe('LIV');
    expect(team[1]).toBe('');
    expect(team[2]).toBe('ARS');
  });

  it('drops source rows with no match in base (left join semantics)', () => {
    const base   = makeBase([1, 2]);
    // Source has id 3 which doesn't exist in base
    const source = makeSource([1, 2, 3], { score: new Float64Array([10, 20, 99]) });

    const result = mergePanels(base, source);
    expect(result.rowCount).toBe(2);
    const score = result.getNumeric('score')!;
    expect(score[0]).toBe(10);
    expect(score[1]).toBe(20);
  });

  it('throws when base has no id column', () => {
    const noId = new Panel(2, { score: new Float64Array([1, 2]) });
    const src  = makeSource([1, 2], { xg: new Float64Array([0.1, 0.2]) });
    expect(() => mergePanels(noId, src)).toThrow("id");
  });

  it('throws when a source panel has no id column', () => {
    const base  = makeBase([1, 2]);
    const noId  = new Panel(2, { xg: new Float64Array([0.1, 0.2]) });
    expect(() => mergePanels(base, noId)).toThrow("id");
  });

  it('first-write-wins: existing column in base is not overwritten', () => {
    const base   = makeBase([1, 2], { score: new Float64Array([100, 200]) });
    const source = makeSource([1, 2], { score: new Float64Array([1, 2]) });

    const result = mergePanels(base, source);
    // Base value wins
    const score = result.getNumeric('score')!;
    expect(score[0]).toBe(100);
    expect(score[1]).toBe(200);
  });

  it('does not mutate the base panel', () => {
    const base   = makeBase([1, 2]);
    const source = makeSource([1, 2], { xg: new Float64Array([0.5, 1.0]) });
    const colsBefore = base.columnNames().length;
    mergePanels(base, source);
    expect(base.columnNames().length).toBe(colsBefore);
    expect(base.has('xg')).toBe(false);
  });

  it('merging with no sources returns a copy of base', () => {
    const base = makeBase([1, 2, 3], { score: new Float64Array([10, 20, 30]) });
    const result = mergePanels(base);
    expect(result.rowCount).toBe(3);
    expect(result.columnNames()).toEqual(base.columnNames());
  });

  it('id column in result comes from base (not overwritten by source)', () => {
    const base   = makeBase([1, 2]);
    const source = makeSource([1, 2], { xg: new Float64Array([0.1, 0.2]) });
    const result = mergePanels(base, source);
    // id column should match base
    expect(result.getNumeric('id')).toEqual(new Float64Array([1, 2]));
  });
});

// ── fplSource smoke test ──────────────────────────────────────────────────────

describe('fplSource (023)', () => {
  it('fplSource.load() returns a Panel with 841 rows', () => {
    const panel = fplSource.load() as Panel;
    expect(panel.rowCount).toBe(841);
  });

  it('fplSource.load() result has an id column', () => {
    const panel = fplSource.load() as Panel;
    expect(panel.has('id')).toBe(true);
    const idCol = panel.getNumeric('id');
    expect(idCol).toBeDefined();
  });

  it('fplSource.id is "fpl"', () => {
    expect(fplSource.id).toBe('fpl');
  });

  it('fplSource.fields matches FPL_FIELDS catalog', () => {
    expect(fplSource.fields.length).toBeGreaterThan(0);
    expect(fplSource.fields.every(f => f.source === 'fpl')).toBe(true);
  });
});
