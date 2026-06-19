import type { SourceSpan } from '../types.js';

/** All token types, as string literals. */
export const TT = {
  NUMBER:  'NUMBER',
  STRING:  'STRING',
  IDENT:   'IDENT',
  // arithmetic
  PLUS:    '+',
  MINUS:   '-',
  STAR:    '*',
  SLASH:   '/',
  PERCENT: '%',
  // comparison (two-char must come before single-char variants)
  EQ:      '==',
  NEQ:     '!=',
  LTE:     '<=',
  GTE:     '>=',
  LT:      '<',
  GT:      '>',
  // assignment (single =, distinguished from == by the lexer)
  ASSIGN:  '=',
  // punctuation
  LPAREN:  '(',
  RPAREN:  ')',
  COMMA:   ',',
  DOT:     '.',
  // structural
  NEWLINE: 'NEWLINE',
  EOF:     'EOF',
} as const;

export type TokenType = (typeof TT)[keyof typeof TT];

export interface Token {
  type: TokenType;
  /** Raw text of the token (number string, identifier name, string contents, operator chars). */
  value: string;
  from: number;
  to: number;
  span: SourceSpan;
}
