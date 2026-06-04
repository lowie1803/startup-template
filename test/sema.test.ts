/**
 * Tests for the sema pipeline: dep graph, topo sort, cycle detection,
 * classification, and typecheck.
 * Covers backlog items 003, 004, 005.
 */

import { describe, it, expect } from 'vitest';
import { analyze, listFields } from '../src/index.js';

const fields = listFields();

// ── Helper: run analyze and return the result ─────────────────────────────────

function sema(text: string) {
  return analyze(text, fields);
}

function errorMessages(text: string): string[] {
  return sema(text).diagnostics
    .filter(d => d.severity === 'error')
    .map(d => d.message);
}

// ── Topo sort (003) ───────────────────────────────────────────────────────────

describe('dep graph + topo sort', () => {
  it('independent factors keep document order', () => {
    const { order } = sema('a = 1\nb = 2');
    expect(order).toEqual(['a', 'b']);
  });

  it('reverses evaluation order when b depends on a (a defined after b)', () => {
    // b = a + 1 comes first in doc, but a must evaluate first
    const { order } = sema('b = a + 1\na = total_points');
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
  });

  it('three-level chain is sorted a→b→c', () => {
    const { order } = sema('c = b + 1\nb = a + 1\na = total_points');
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('factors with no inter-dependencies keep source order', () => {
    const { order } = sema('x = price\ny = form\nz = minutes');
    expect(order).toEqual(['x', 'y', 'z']);
  });
});

// ── Cycle detection (003) ─────────────────────────────────────────────────────

describe('cycle detection', () => {
  it('two-node cycle produces errors for both members', () => {
    const msgs = errorMessages('a = b + 1\nb = a + 1');
    expect(msgs.some(m => m.includes('Cycle') && m.includes('a'))).toBe(true);
    expect(msgs.some(m => m.includes('Cycle') && m.includes('b'))).toBe(true);
  });

  it('cycle members appear in order after acyclic factors', () => {
    const { order } = sema('a = b + 1\nb = a + 1\nc = total_points');
    // c has no deps — should appear before the cycle pair
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'));
  });

  it('a three-node cycle flags all three', () => {
    const msgs = errorMessages('a = b\nb = c\nc = a');
    expect(msgs.filter(m => m.includes('Cycle'))).toHaveLength(3);
  });

  it('self-reference is a cycle', () => {
    const msgs = errorMessages('a = a + 1');
    expect(msgs.some(m => m.includes('Cycle') && m.includes('a'))).toBe(true);
  });
});

// ── Classification (004) ──────────────────────────────────────────────────────

describe('classification', () => {
  it('plain arithmetic is scalar', () => {
    const { classifications } = sema('v = total_points / price');
    expect(classifications['v']).toBe('scalar');
  });

  it('z() call marks factor as xs', () => {
    const { classifications } = sema('r = z(form)');
    expect(classifications['r']).toBe('xs');
  });

  it('rank() call marks factor as xs', () => {
    const { classifications } = sema('r = rank(price)');
    expect(classifications['r']).toBe('xs');
  });

  it('ts_mean() call marks factor as ts', () => {
    const { classifications } = sema('m = ts_mean(series(total_points), 5)');
    expect(classifications['m']).toBe('ts');
  });

  it('combined xs+ts call', () => {
    const { classifications } = sema('hot = z(ts_mean(series(form), 3))');
    expect(classifications['hot']).toBe('xs+ts');
  });

  it('class propagation: dep on xs factor → promoted to xs', () => {
    const { classifications } = sema('base = z(form)\ncomp = base + 1');
    expect(classifications['comp']).toBe('xs');
  });

  it('class propagation: dep on ts factor → promoted to ts', () => {
    const { classifications } = sema(
      'm = ts_mean(series(total_points), 5)\nsmoothed = m + form',
    );
    expect(classifications['smoothed']).toBe('ts');
  });

  it('class propagation through chain', () => {
    const { classifications } = sema(
      'b = z(form)\nc = b + 1\nd = c + 1',
    );
    expect(classifications['d']).toBe('xs');
  });
});

// ── Typecheck — unknown names (005) ───────────────────────────────────────────

describe('typecheck: unknown names', () => {
  it('unknown identifier produces an error', () => {
    const msgs = errorMessages('x = nope + 1');
    expect(msgs.some(m => m.includes("Unknown name 'nope'"))).toBe(true);
  });

  it('base field reference produces no error', () => {
    const msgs = errorMessages('x = total_points / price');
    expect(msgs).toHaveLength(0);
  });

  it('forward reference to a factor in the same doc is valid', () => {
    // b defined after a — still valid because we collect all factor names first
    const msgs = errorMessages('a = b + 1\nb = total_points');
    // no "Unknown name" errors (cycle errors may appear but that's separate)
    expect(msgs.some(m => m.includes("Unknown name 'b'"))).toBe(false);
  });

  it('assist_points constant is recognised', () => {
    const msgs = errorMessages('ap = assists * assist_points');
    expect(msgs.some(m => m.includes('Unknown'))).toBe(false);
  });
});

// ── Typecheck — unknown functions (005) ───────────────────────────────────────

describe('typecheck: unknown functions', () => {
  it('unknown function call produces an error', () => {
    const msgs = errorMessages('x = magic(form)');
    expect(msgs.some(m => m.includes("Unknown function 'magic'"))).toBe(true);
  });

  it('documented function does not produce an error', () => {
    const msgs = errorMessages('x = clamp(form, 0, 10)');
    expect(msgs.some(m => m.includes('Unknown function'))).toBe(false);
  });

  it('xs function does not produce an unknown-function error', () => {
    const msgs = errorMessages('x = rank(price)').filter(m =>
      m.includes('Unknown function'),
    );
    expect(msgs).toHaveLength(0);
  });
});

// ── Typecheck — arity (005) ───────────────────────────────────────────────────

describe('typecheck: arity', () => {
  it('too few args to iff', () => {
    const msgs = errorMessages('x = iff(1, 2)');
    expect(msgs.some(m => m.includes("'iff'") && m.includes('exactly 3'))).toBe(true);
  });

  it('too many args to abs', () => {
    const msgs = errorMessages('x = abs(1, 2)');
    expect(msgs.some(m => m.includes("'abs'") && m.includes('exactly 1'))).toBe(true);
  });

  it('correct arity produces no error', () => {
    const msgs = errorMessages('x = iff(minutes > 0, 1, 0)');
    expect(msgs.some(m => m.includes("'iff'"))).toBe(false);
  });

  it('coalesce variadic: 2 args ok', () => {
    const msgs = errorMessages('x = coalesce(chance_of_playing_next_round, 100)');
    expect(msgs.some(m => m.includes("'coalesce'"))).toBe(false);
  });
});

// ── Typecheck — series() misuse (005) ─────────────────────────────────────────

describe('typecheck: series() misuse', () => {
  it('series() outside ts_* is an error', () => {
    const msgs = errorMessages('x = series(form) + 1');
    expect(msgs.some(m => m.includes("series()"))).toBe(true);
  });

  it('series() as first arg of ts_mean is valid', () => {
    const msgs = errorMessages('x = ts_mean(series(total_points), 5)');
    expect(msgs.some(m => m.includes("series()"))).toBe(false);
  });

  it('series() as second arg of ts_mean is an error', () => {
    // Second arg should be a number, but series() is still structurally misused
    const msgs = errorMessages('x = ts_mean(series(total_points), series(form))');
    expect(msgs.some(m => m.includes("series()"))).toBe(true);
  });
});

// ── Typecheck — string arithmetic (005) ───────────────────────────────────────

describe('typecheck: string arithmetic', () => {
  it('adding a string field to a number is an error', () => {
    const msgs = errorMessages('x = total_points + position');
    expect(msgs.some(m => m.includes('string') || m.includes('Arithmetic'))).toBe(true);
  });

  it('equality comparison with string field is allowed', () => {
    const msgs = errorMessages('x = iff(position == "FWD", 1, 0)');
    expect(msgs.some(m => m.includes('Arithmetic'))).toBe(false);
  });

  it('arithmetic on string literal is an error', () => {
    const msgs = errorMessages('x = total_points + "hello"');
    expect(msgs.some(m => m.includes('Arithmetic') || m.includes('string'))).toBe(true);
  });
});

// ── Typecheck — duplicate names (005) ────────────────────────────────────────

describe('typecheck: duplicate names', () => {
  it('duplicate factor name produces an error', () => {
    const msgs = errorMessages('a = 1\na = 2');
    expect(msgs.some(m => m.includes("Duplicate factor name 'a'"))).toBe(true);
  });

  it('unique names produce no duplicate error', () => {
    const msgs = errorMessages('a = 1\nb = 2');
    expect(msgs.some(m => m.includes('Duplicate'))).toBe(false);
  });
});

// ── completions ───────────────────────────────────────────────────────────────

describe('completions', () => {
  it('includes base fields', () => {
    const { completions } = sema('');
    expect(completions).toContain('total_points');
    expect(completions).toContain('price');
  });

  it('includes function names from the catalog', () => {
    const { completions } = sema('');
    expect(completions).toContain('z');
    expect(completions).toContain('ts_mean');
    expect(completions).toContain('rank');
  });

  it('includes defined factor names', () => {
    const { completions } = sema('my_factor = total_points / price');
    expect(completions).toContain('my_factor');
  });
});
