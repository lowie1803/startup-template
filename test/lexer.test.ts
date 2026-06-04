import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lexer/lexer.js';
import { TT } from '../src/lexer/token.js';

describe('tokenize', () => {
  it('tokenizes a simple assignment', () => {
    const { tokens, diagnostics } = tokenize('value = total_points / price');
    expect(diagnostics).toHaveLength(0);
    const types = tokens.map(t => t.type);
    expect(types).toEqual([TT.IDENT, TT.ASSIGN, TT.IDENT, TT.SLASH, TT.IDENT, TT.EOF]);
    expect(tokens[0]?.value).toBe('value');
    expect(tokens[2]?.value).toBe('total_points');
  });

  it('carries correct spans', () => {
    const { tokens } = tokenize('a + bb');
    // a: 0-1, +: 2-3, bb: 4-6
    expect(tokens[0]).toMatchObject({ from: 0, to: 1 });
    expect(tokens[1]).toMatchObject({ from: 2, to: 3 });
    expect(tokens[2]).toMatchObject({ from: 4, to: 6 });
  });

  it('tokenizes number literals', () => {
    const { tokens } = tokenize('3.14');
    expect(tokens[0]).toMatchObject({ type: TT.NUMBER, value: '3.14' });
  });

  it('tokenizes string literals', () => {
    const { tokens } = tokenize('"GKP"');
    expect(tokens[0]).toMatchObject({ type: TT.STRING, value: 'GKP' });
  });

  it('skips comments', () => {
    const { tokens } = tokenize('a # this is a comment\nb');
    const types = tokens.map(t => t.type);
    expect(types).toEqual([TT.IDENT, TT.NEWLINE, TT.IDENT, TT.EOF]);
    expect(tokens[0]?.value).toBe('a');
    expect(tokens[2]?.value).toBe('b');
  });

  it('emits NEWLINE tokens', () => {
    const { tokens } = tokenize('a\nb');
    expect(tokens[1]?.type).toBe(TT.NEWLINE);
  });

  it('tokenizes two-char operators', () => {
    const src = 'a == b != c <= d >= e';
    const { tokens } = tokenize(src);
    const opTypes = tokens.filter(t =>
      [TT.EQ, TT.NEQ, TT.LTE, TT.GTE].includes(t.type as typeof TT.EQ),
    ).map(t => t.type);
    expect(opTypes).toEqual([TT.EQ, TT.NEQ, TT.LTE, TT.GTE]);
  });

  it('tokenizes < and > without consuming the second char', () => {
    const { tokens } = tokenize('a < b > c');
    const ops = tokens.filter(t => t.type === TT.LT || t.type === TT.GT);
    expect(ops[0]?.type).toBe(TT.LT);
    expect(ops[1]?.type).toBe(TT.GT);
  });

  it('emits a diagnostic for unterminated strings', () => {
    const { diagnostics } = tokenize('"hello');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toMatch(/unterminated/i);
  });

  it('emits a diagnostic for unknown characters', () => {
    const { diagnostics } = tokenize('@foo');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('error');
  });

  it('handles multiple assignments separated by newlines', () => {
    const { tokens, diagnostics } = tokenize('a = 1\nb = 2');
    expect(diagnostics).toHaveLength(0);
    expect(tokens.some(t => t.type === TT.NEWLINE)).toBe(true);
  });

  it('appends EOF', () => {
    const { tokens } = tokenize('x');
    expect(tokens[tokens.length - 1]?.type).toBe(TT.EOF);
  });
});
