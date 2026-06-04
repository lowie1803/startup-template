import type { Diagnostic } from '../types.js';
import { TT, type Token, type TokenType } from './token.js';

/** Two-character operator map (checked before single-char). */
const TWO_CHAR: Record<string, TokenType> = {
  '==': TT.EQ,
  '!=': TT.NEQ,
  '<=': TT.LTE,
  '>=': TT.GTE,
};

/** Single-character operator map. */
const ONE_CHAR: Record<string, TokenType> = {
  '+': TT.PLUS,
  '-': TT.MINUS,
  '*': TT.STAR,
  '/': TT.SLASH,
  '%': TT.PERCENT,
  '=': TT.ASSIGN,
  '<': TT.LT,
  '>': TT.GT,
  '(': TT.LPAREN,
  ')': TT.RPAREN,
  ',': TT.COMMA,
};

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isAlphaNum(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch);
}

function makeToken(type: TokenType, value: string, from: number, to: number): Token {
  return { type, value, from, to, span: { from, to } };
}

/**
 * Lex the source text into a flat token array.
 * - Horizontal whitespace (space, tab, CR) is skipped.
 * - '#' through end-of-line is a comment (skipped).
 * - '\n' emits a NEWLINE token.
 * - Unterminated strings and unknown characters produce diagnostics rather than throwing.
 */
export function tokenize(text: string): { tokens: Token[]; diagnostics: Diagnostic[] } {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let pos = 0;

  while (pos < text.length) {
    const start = pos;
    const ch = text[pos] as string; // safe: pos < text.length

    // ── Skip horizontal whitespace ────────────────────────────────────────────
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      pos++;
      continue;
    }

    // ── Newline ───────────────────────────────────────────────────────────────
    if (ch === '\n') {
      tokens.push(makeToken(TT.NEWLINE, '\n', start, pos + 1));
      pos++;
      continue;
    }

    // ── Comment ───────────────────────────────────────────────────────────────
    if (ch === '#') {
      while (pos < text.length && text[pos] !== '\n') pos++;
      continue;
    }

    // ── Number: integer or decimal ────────────────────────────────────────────
    if (isDigit(ch) || (ch === '.' && pos + 1 < text.length && isDigit(text[pos + 1] as string))) {
      while (pos < text.length && isDigit(text[pos] as string)) pos++;
      if (pos < text.length && text[pos] === '.') {
        pos++;
        while (pos < text.length && isDigit(text[pos] as string)) pos++;
      }
      tokens.push(makeToken(TT.NUMBER, text.slice(start, pos), start, pos));
      continue;
    }

    // ── String ────────────────────────────────────────────────────────────────
    if (ch === '"') {
      pos++; // consume opening quote
      while (pos < text.length && text[pos] !== '"' && text[pos] !== '\n') pos++;
      if (pos >= text.length || text[pos] === '\n') {
        diagnostics.push({
          message: 'Unterminated string literal',
          severity: 'error',
          from: start,
          to: pos,
        });
        tokens.push(makeToken(TT.STRING, text.slice(start + 1, pos), start, pos));
      } else {
        pos++; // consume closing quote
        tokens.push(makeToken(TT.STRING, text.slice(start + 1, pos - 1), start, pos));
      }
      continue;
    }

    // ── Identifier ────────────────────────────────────────────────────────────
    if (isAlpha(ch)) {
      while (pos < text.length && isAlphaNum(text[pos] as string)) pos++;
      tokens.push(makeToken(TT.IDENT, text.slice(start, pos), start, pos));
      continue;
    }

    // ── Two-char operators ────────────────────────────────────────────────────
    if (pos + 1 < text.length) {
      const two = text.slice(pos, pos + 2);
      const twoType = TWO_CHAR[two];
      if (twoType !== undefined) {
        tokens.push(makeToken(twoType, two, start, pos + 2));
        pos += 2;
        continue;
      }
    }

    // ── Single-char operators ─────────────────────────────────────────────────
    const oneType = ONE_CHAR[ch];
    if (oneType !== undefined) {
      tokens.push(makeToken(oneType, ch, start, pos + 1));
      pos++;
      continue;
    }

    // ── Unknown character ─────────────────────────────────────────────────────
    diagnostics.push({
      message: `Unexpected character '${ch}'`,
      severity: 'error',
      from: start,
      to: pos + 1,
    });
    pos++;
  }

  tokens.push(makeToken(TT.EOF, '', pos, pos));
  return { tokens, diagnostics };
}
