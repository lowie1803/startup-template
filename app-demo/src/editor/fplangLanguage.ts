/**
 * StreamLanguage tokenizer for fplang — used by CodeMirror for syntax highlighting.
 *
 * Token types → highlight tags (via @lezer/highlight):
 *   keyword       — known function names (z, rank, iff, …)
 *   number        — numeric literals
 *   string        — string literals
 *   lineComment   — # comment to end of line
 *   operator      — + - * / ^ == != <= >= < > = ()
 *   variableName  — identifiers
 */

import { StreamLanguage } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { StringStream } from '@codemirror/language';

// Built-in function names (keep in sync with catalog; completions will augment at runtime)
const BUILTIN_NAMES = new Set([
  'z', 'zscore', 'rank', 'quantile', 'scale', 'demean',
  'iff', 'coalesce', 'per90',
  'min', 'max', 'abs', 'sqrt', 'log', 'exp', 'pow', 'round', 'floor', 'ceil', 'clamp',
  'isnull', 'notnull',
  'goal_points', 'cs_points',
  'ts_mean', 'ts_delta', 'ts_std', 'series',
]);

interface State {
  inString: boolean;
  stringChar: string;
}

export const fplangLanguage = StreamLanguage.define<State>({
  name: 'fplang',

  startState(): State {
    return { inString: false, stringChar: '' };
  },

  token(stream: StringStream, state: State): string | null {
    // ── Continuing string ─────────────────────────────────────────────────────
    if (state.inString) {
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === state.stringChar) {
          state.inString = false;
          break;
        }
      }
      return 'string';
    }

    // ── Whitespace ────────────────────────────────────────────────────────────
    if (stream.eatSpace()) return null;

    // ── Line comment ──────────────────────────────────────────────────────────
    if (stream.eat('#')) {
      stream.skipToEnd();
      return 'lineComment';
    }

    // ── String literal ────────────────────────────────────────────────────────
    const quote = stream.peek();
    if (quote === '"' || quote === "'") {
      stream.next();
      state.inString = true;
      state.stringChar = quote;
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === quote) { state.inString = false; break; }
      }
      return 'string';
    }

    // ── Number ────────────────────────────────────────────────────────────────
    if (stream.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)) {
      return 'number';
    }

    // ── Identifier or keyword ─────────────────────────────────────────────────
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_.]*/)) {
      const word = stream.current();
      if (BUILTIN_NAMES.has(word)) return 'keyword';
      return 'variableName';
    }

    // ── Operators and punctuation ─────────────────────────────────────────────
    if (stream.match(/^(==|!=|<=|>=|<|>|\+|-|\*|\/|\^|=|\(|\)|,)/)) {
      return 'operator';
    }

    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '#' },
  },
});

// Map our token names to @lezer/highlight tags for the default highlight style
export const fplangHighlightStyle = [
  { tag: tags.keyword,       color: '#7c3aed', fontWeight: 'bold' },
  { tag: tags.number,        color: '#059669' },
  { tag: tags.string,        color: '#b45309' },
  { tag: tags.lineComment,   color: '#9ca3af', fontStyle: 'italic' },
  { tag: tags.operator,      color: '#374151' },
  { tag: tags.variableName,  color: '#1e40af' },
];
