import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lexer/lexer.js';
import { parse } from '../src/parser/parser.js';

function parseText(text: string) {
  const { tokens } = tokenize(text);
  return parse(tokens);
}

describe('parse', () => {
  it('parses a simple assignment', () => {
    const { defs, diagnostics } = parseText('value = total_points / price');
    expect(diagnostics).toHaveLength(0);
    expect(defs).toHaveLength(1);
    expect(defs[0]?.name).toBe('value');
    expect(defs[0]?.kind).toBe('Assignment');
  });

  it('parses a number literal', () => {
    const { defs } = parseText('x = 42');
    const expr = defs[0]?.expr;
    expect(expr?.kind).toBe('NumberLit');
    if (expr?.kind === 'NumberLit') expect(expr.value).toBe(42);
  });

  it('parses a string literal', () => {
    const { defs } = parseText('p = "GKP"');
    const expr = defs[0]?.expr;
    expect(expr?.kind).toBe('StringLit');
    if (expr?.kind === 'StringLit') expect(expr.value).toBe('GKP');
  });

  it('parses a function call', () => {
    const { defs, diagnostics } = parseText('v = iff(x > 0, 1, 0)');
    expect(diagnostics).toHaveLength(0);
    const expr = defs[0]?.expr;
    expect(expr?.kind).toBe('Call');
    if (expr?.kind === 'Call') {
      expect(expr.callee).toBe('iff');
      expect(expr.args).toHaveLength(3);
    }
  });

  it('respects operator precedence: * before +', () => {
    const { defs } = parseText('r = 2 + 3 * 4');
    const expr = defs[0]?.expr;
    // Should parse as 2 + (3 * 4), so root is Binary(+)
    expect(expr?.kind).toBe('Binary');
    if (expr?.kind === 'Binary') {
      expect(expr.op).toBe('+');
      expect(expr.right.kind).toBe('Binary');
      if (expr.right.kind === 'Binary') expect(expr.right.op).toBe('*');
    }
  });

  it('respects parentheses', () => {
    const { defs } = parseText('r = (2 + 3) * 4');
    const expr = defs[0]?.expr;
    expect(expr?.kind).toBe('Binary');
    if (expr?.kind === 'Binary') {
      expect(expr.op).toBe('*');
      expect(expr.left.kind).toBe('Binary');
      if (expr.left.kind === 'Binary') expect(expr.left.op).toBe('+');
    }
  });

  it('parses comparison operators', () => {
    const { defs } = parseText('r = a >= b');
    const expr = defs[0]?.expr;
    expect(expr?.kind).toBe('Binary');
    if (expr?.kind === 'Binary') expect(expr.op).toBe('>=');
  });

  it('parses unary minus', () => {
    const { defs } = parseText('r = -x');
    const expr = defs[0]?.expr;
    expect(expr?.kind).toBe('Unary');
    if (expr?.kind === 'Unary') expect(expr.op).toBe('-');
  });

  it('parses multiple assignments', () => {
    const { defs, diagnostics } = parseText('a = 1\nb = 2\nc = a + b');
    expect(diagnostics).toHaveLength(0);
    expect(defs).toHaveLength(3);
    expect(defs.map(d => d.name)).toEqual(['a', 'b', 'c']);
  });

  it('parses assignments separated by comments', () => {
    const { defs } = parseText('a = 1 # comment\nb = 2');
    expect(defs).toHaveLength(2);
  });

  it('carries span info on assignments', () => {
    const { defs } = parseText('val = 99');
    const def = defs[0];
    expect(def?.nameSpan.from).toBe(0);
    expect(def?.nameSpan.to).toBe(3); // 'val' is 3 chars
  });

  it('recovers from a bad line and continues parsing', () => {
    const { defs, diagnostics } = parseText('good = 1\n123\nbetter = 2');
    // '123' (a number) is not a valid assignment start — should produce a diagnostic
    expect(diagnostics.length).toBeGreaterThan(0);
    // but 'good' and 'better' should still parse
    expect(defs.some(d => d.name === 'good')).toBe(true);
    expect(defs.some(d => d.name === 'better')).toBe(true);
  });
});
