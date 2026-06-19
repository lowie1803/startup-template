/**
 * Tests for qualified name (source.field) support.
 * Covers backlog items 019 (parser) and 020 (sema + runtime).
 */

import { describe, it, expect } from 'vitest';
import { parse, analyze, evaluate } from '../src/index.js';
import { Panel } from '../src/runtime/panel.js';
import { FPL_FIELDS } from '../src/catalog/fields.js';
import type { FieldDef } from '../src/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function errors(text: string, fields: readonly FieldDef[] = FPL_FIELDS): string[] {
  return analyze(text, fields as FieldDef[]).diagnostics
    .filter(d => d.severity === 'error')
    .map(d => d.message);
}

/** Minimal fields list: fpl fields + a couple of understat fields. */
const MIXED_FIELDS: FieldDef[] = [
  ...FPL_FIELDS,
  {
    name: 'xg',
    source: 'understat',
    type: 'number',
    description: 'Expected goals from Understat',
    fill: { kind: 'zero' },
  },
  {
    name: 'xa',
    source: 'understat',
    type: 'number',
    description: 'Expected assists from Understat',
    fill: { kind: 'zero' },
  },
];

// ── 019: Parser ───────────────────────────────────────────────────────────────

describe('QualifiedName parsing (019)', () => {
  it('fpl.goals_scored parses to a QualifiedName node', () => {
    const { defs, diagnostics } = parse('x = fpl.goals_scored');
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    expect(defs).toHaveLength(1);
    const expr = defs[0]!.expr;
    expect(expr.kind).toBe('QualifiedName');
    if (expr.kind === 'QualifiedName') {
      expect(expr.source).toBe('fpl');
      expect(expr.field).toBe('goals_scored');
    }
  });

  it('understat.xg parses to a QualifiedName node', () => {
    const { defs, diagnostics } = parse('alpha = understat.xg');
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    const expr = defs[0]!.expr;
    expect(expr.kind).toBe('QualifiedName');
    if (expr.kind === 'QualifiedName') {
      expect(expr.source).toBe('understat');
      expect(expr.field).toBe('xg');
    }
  });

  it('z(fpl.form) has a QualifiedName as the argument', () => {
    const { defs, diagnostics } = parse('x = z(fpl.form)');
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    const expr = defs[0]!.expr;
    expect(expr.kind).toBe('Call');
    if (expr.kind === 'Call') {
      expect(expr.callee).toBe('z');
      expect(expr.args[0]?.kind).toBe('QualifiedName');
      if (expr.args[0]?.kind === 'QualifiedName') {
        expect(expr.args[0].source).toBe('fpl');
        expect(expr.args[0].field).toBe('form');
      }
    }
  });

  it('function call syntax (z(form)) is not affected — no QualifiedName created', () => {
    const { defs, diagnostics } = parse('x = z(form)');
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    const expr = defs[0]!.expr;
    expect(expr.kind).toBe('Call');
    if (expr.kind === 'Call') {
      expect(expr.callee).toBe('z');
      expect(expr.args[0]?.kind).toBe('Identifier');
    }
  });

  it('QualifiedName carries correct source spans', () => {
    // "x = fpl.goals_scored"
    //  0123456789...
    const { defs } = parse('x = fpl.goals_scored');
    const expr = defs[0]!.expr;
    if (expr.kind === 'QualifiedName') {
      // 'fpl' starts at offset 4
      expect(expr.sourceSpan.from).toBe(4);
      expect(expr.sourceSpan.to).toBe(7);
      // 'goals_scored' starts at offset 8
      expect(expr.fieldSpan.from).toBe(8);
      // full span
      expect(expr.span.from).toBe(4);
      expect(expr.span.to).toBe(expr.fieldSpan.to);
    }
  });
});

// ── 020: Sema ─────────────────────────────────────────────────────────────────

describe('QualifiedName sema (020)', () => {
  it('fpl.goals_scored resolves without error', () => {
    expect(errors('x = fpl.goals_scored')).toHaveLength(0);
  });

  it('understat.xg with understat in fields resolves without error', () => {
    expect(errors('x = understat.xg', MIXED_FIELDS)).toHaveLength(0);
  });

  it('unknown source nope.xg → "Unknown source \'nope\'"', () => {
    const msgs = errors('x = nope.xg');
    expect(msgs).toContain("Unknown source 'nope'");
  });

  it('known source, unknown field fpl.nope → "Unknown field \'nope\' in source \'fpl\'"', () => {
    const msgs = errors('x = fpl.nope');
    expect(msgs).toContain("Unknown field 'nope' in source 'fpl'");
  });

  it('bare understat identifier → "Unknown name \'understat\'" or source-reserved error', () => {
    // understat is a known source in MIXED_FIELDS — should get "source identifier" error
    const msgs = errors('x = understat', MIXED_FIELDS);
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0]).toMatch(/understat/);
  });

  it('bare xg (not an fpl field) → "Unknown name \'xg\'"', () => {
    // xg is in understat source but NOT in fpl source — bare use should fail
    const msgs = errors('x = xg', MIXED_FIELDS);
    expect(msgs).toContain("Unknown name 'xg'");
  });

  it('bare goals_scored still resolves without error (fpl default)', () => {
    expect(errors('x = goals_scored')).toHaveLength(0);
  });

  it('fpl.total_points + fpl.price resolves without error', () => {
    expect(errors('x = fpl.total_points + fpl.price')).toHaveLength(0);
  });

  it('z(fpl.form) resolves without error', () => {
    expect(errors('x = z(fpl.form)')).toHaveLength(0);
  });
});

// ── 020: Classification ───────────────────────────────────────────────────────

describe('Classification with QualifiedName (020)', () => {
  it('z(fpl.form) is classified as xs', () => {
    const result = analyze('x = z(fpl.form)', FPL_FIELDS);
    expect(result.classifications['x']).toBe('xs');
  });

  it('fpl.total_points / fpl.price is classified as scalar', () => {
    const result = analyze('x = fpl.total_points / fpl.price', FPL_FIELDS);
    expect(result.classifications['x']).toBe('scalar');
  });
});

// ── 020: Runtime evaluation ───────────────────────────────────────────────────

describe('Runtime: QualifiedName evaluation (020)', () => {
  it('fpl.total_points / fpl.price evaluates correctly on a mini panel', () => {
    const panel = new Panel(3, {
      total_points: new Float64Array([100, 200, 150]),
      price:        new Float64Array([10,   5,  7.5]),
    });
    const result = evaluate('value = fpl.total_points / fpl.price', panel, FPL_FIELDS);
    expect(result.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    const col = result.panel.getNumeric('value');
    expect(col?.[0]).toBeCloseTo(10, 5);
    expect(col?.[1]).toBeCloseTo(40, 5);
    expect(col?.[2]).toBeCloseTo(20, 5);
  });

  it('understat.xg evaluates correctly from panel column', () => {
    const panel = new Panel(2, {
      xg: new Float64Array([2.5, 1.1]),
    });
    const result = evaluate('alpha = understat.xg', panel, MIXED_FIELDS);
    expect(result.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    const col = result.panel.getNumeric('alpha');
    expect(col?.[0]).toBeCloseTo(2.5, 5);
    expect(col?.[1]).toBeCloseTo(1.1, 5);
  });
});

// ── Completions ───────────────────────────────────────────────────────────────

describe('Completions with mixed sources (020)', () => {
  it('includes source.field completions for non-fpl sources', () => {
    const result = analyze('x = goals_scored', MIXED_FIELDS);
    expect(result.completions).toContain('understat.xg');
    expect(result.completions).toContain('understat.xa');
  });

  it('includes bare names for fpl fields', () => {
    const result = analyze('x = goals_scored', MIXED_FIELDS);
    expect(result.completions).toContain('goals_scored');
    expect(result.completions).toContain('total_points');
  });

  it('does NOT include bare understat field names in completions', () => {
    const result = analyze('x = goals_scored', MIXED_FIELDS);
    // bare 'xg' should not appear — only 'understat.xg'
    expect(result.completions).not.toContain('xg');
  });
});
