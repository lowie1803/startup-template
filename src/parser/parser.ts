import type { Diagnostic } from '../types.js';
import { TT, type Token, type TokenType } from '../lexer/token.js';
import type { Expr, Assignment, BinaryOp } from './ast.js';

// ── Precedence levels (Pratt) ─────────────────────────────────────────────────

const PREC_NONE       = 0;
const PREC_COMPARISON = 1;  // == != < > <= >=
const PREC_ADDITIVE   = 2;  // + -
const PREC_MULTI      = 3;  // * / %
// unary - handled in prefix position (no infix precedence needed)

/** Infix operator → [token type, precedence, BinaryOp] */
const INFIX_OPS: Partial<Record<TokenType, { prec: number; op: BinaryOp }>> = {
  [TT.EQ]:      { prec: PREC_COMPARISON, op: '==' },
  [TT.NEQ]:     { prec: PREC_COMPARISON, op: '!=' },
  [TT.LT]:      { prec: PREC_COMPARISON, op: '<'  },
  [TT.GT]:      { prec: PREC_COMPARISON, op: '>'  },
  [TT.LTE]:     { prec: PREC_COMPARISON, op: '<=' },
  [TT.GTE]:     { prec: PREC_COMPARISON, op: '>=' },
  [TT.PLUS]:    { prec: PREC_ADDITIVE,   op: '+'  },
  [TT.MINUS]:   { prec: PREC_ADDITIVE,   op: '-'  },
  [TT.STAR]:    { prec: PREC_MULTI,      op: '*'  },
  [TT.SLASH]:   { prec: PREC_MULTI,      op: '/'  },
  [TT.PERCENT]: { prec: PREC_MULTI,      op: '%'  },
};

// ── Token stream ──────────────────────────────────────────────────────────────

const EOF_TOKEN: Token = {
  type: TT.EOF, value: '', from: 0, to: 0, span: { from: 0, to: 0 },
};

class TokenStream {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  peek(): Token {
    return this.tokens[this.pos] ?? EOF_TOKEN;
  }

  advance(): Token {
    const t = this.peek();
    if (t.type !== TT.EOF) this.pos++;
    return t;
  }

  /** Consume one NEWLINE (or multiple), returning true if any were consumed. */
  skipNewlines(): boolean {
    let any = false;
    while (this.peek().type === TT.NEWLINE) {
      this.advance();
      any = true;
    }
    return any;
  }

  check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  eat(type: TokenType): Token | undefined {
    if (this.check(type)) return this.advance();
    return undefined;
  }
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parse(
  tokens: Token[],
): { defs: Assignment[]; diagnostics: Diagnostic[] } {
  const stream = new TokenStream(tokens);
  const defs: Assignment[] = [];
  const diagnostics: Diagnostic[] = [];

  stream.skipNewlines();

  while (!stream.check(TT.EOF)) {
    parseLine(stream, defs, diagnostics);
    // Consume trailing newline(s) or EOF
    if (!stream.skipNewlines() && !stream.check(TT.EOF)) {
      // Unexpected token — skip to next newline/EOF to recover
      const bad = stream.peek();
      diagnostics.push({
        message: `Unexpected token '${bad.value}'`,
        severity: 'error',
        from: bad.from,
        to: bad.to,
      });
      while (!stream.check(TT.NEWLINE) && !stream.check(TT.EOF)) stream.advance();
      stream.skipNewlines();
    }
  }

  return { defs, diagnostics };
}

/** Parse one `name = expr` assignment line (or recover to end of line). */
function parseLine(
  stream: TokenStream,
  defs: Assignment[],
  diagnostics: Diagnostic[],
): void {
  // Look ahead: if the *second* token is ASSIGN (=), treat this as an assignment.
  // We peek once — if not IDENT we just try to parse an expression and discard.
  const nameTok = stream.peek();
  if (nameTok.type !== TT.IDENT) {
    // Not an assignment — skip to next newline
    const bad = stream.peek();
    if (bad.type !== TT.NEWLINE && bad.type !== TT.EOF) {
      diagnostics.push({
        message: `Expected an assignment (name = expr), got '${bad.value}'`,
        severity: 'error',
        from: bad.from,
        to: bad.to,
      });
      while (!stream.check(TT.NEWLINE) && !stream.check(TT.EOF)) stream.advance();
    }
    return;
  }

  // Tentatively consume name
  stream.advance();

  const assignTok = stream.peek();
  if (assignTok.type !== TT.ASSIGN) {
    // Not an assignment — put a diagnostic and recover
    diagnostics.push({
      message: `Expected '=' after '${nameTok.value}'`,
      severity: 'error',
      from: assignTok.from,
      to: assignTok.to,
    });
    while (!stream.check(TT.NEWLINE) && !stream.check(TT.EOF)) stream.advance();
    return;
  }
  stream.advance(); // consume '='

  const exprStart = stream.peek().from;
  const expr = parseExpr(stream, PREC_NONE, diagnostics);
  if (expr === null) {
    // Recovery: skip to end of line
    while (!stream.check(TT.NEWLINE) && !stream.check(TT.EOF)) stream.advance();
    return;
  }

  const span = { from: nameTok.from, to: expr.span.to };
  defs.push({
    kind: 'Assignment',
    name: nameTok.value,
    nameSpan: nameTok.span,
    expr,
    span,
  });
}

/**
 * Pratt expression parser.
 * Returns null if no expression could be parsed (already logged a diagnostic).
 */
function parseExpr(
  stream: TokenStream,
  minPrec: number,
  diagnostics: Diagnostic[],
): Expr | null {
  let left = parsePrefix(stream, diagnostics);
  if (left === null) return null;

  for (;;) {
    const opTok = stream.peek();
    const entry = INFIX_OPS[opTok.type];
    if (entry === undefined || entry.prec <= minPrec) break;

    stream.advance(); // consume operator
    const right = parseExpr(stream, entry.prec, diagnostics);
    if (right === null) return left; // partial, but keep what we have

    left = {
      kind: 'Binary',
      op: entry.op,
      left,
      right,
      span: { from: left.span.from, to: right.span.to },
    };
  }

  return left;
}

/** Prefix / primary parse. */
function parsePrefix(
  stream: TokenStream,
  diagnostics: Diagnostic[],
): Expr | null {
  const tok = stream.peek();

  // Unary minus
  if (tok.type === TT.MINUS) {
    stream.advance();
    const expr = parsePrefix(stream, diagnostics);
    if (expr === null) return null;
    return {
      kind: 'Unary',
      op: '-',
      expr,
      span: { from: tok.from, to: expr.span.to },
    };
  }

  // Parenthesised expression
  if (tok.type === TT.LPAREN) {
    stream.advance();
    const expr = parseExpr(stream, PREC_NONE, diagnostics);
    if (expr === null) return null;
    const close = stream.eat(TT.RPAREN);
    if (!close) {
      const cur = stream.peek();
      diagnostics.push({
        message: "Expected ')'",
        severity: 'error',
        from: cur.from,
        to: cur.to,
      });
    }
    const to = close ? close.to : expr.span.to;
    return { ...expr, span: { from: tok.from, to } };
  }

  // Number literal
  if (tok.type === TT.NUMBER) {
    stream.advance();
    return { kind: 'NumberLit', value: Number(tok.value), span: tok.span };
  }

  // String literal
  if (tok.type === TT.STRING) {
    stream.advance();
    return { kind: 'StringLit', value: tok.value, span: tok.span };
  }

  // Identifier or function call
  if (tok.type === TT.IDENT) {
    stream.advance();
    // Is it a call?
    if (stream.check(TT.LPAREN)) {
      stream.advance(); // consume '('
      const args: Expr[] = [];
      if (!stream.check(TT.RPAREN)) {
        const first = parseExpr(stream, PREC_NONE, diagnostics);
        if (first !== null) args.push(first);
        while (stream.eat(TT.COMMA)) {
          const arg = parseExpr(stream, PREC_NONE, diagnostics);
          if (arg !== null) args.push(arg);
        }
      }
      const closeTok = stream.eat(TT.RPAREN);
      const to = closeTok ? closeTok.to : (args[args.length - 1]?.span.to ?? tok.to);
      if (!closeTok) {
        const cur = stream.peek();
        diagnostics.push({
          message: `Expected ')' to close call to '${tok.value}'`,
          severity: 'error',
          from: cur.from,
          to: cur.to,
        });
      }
      return {
        kind: 'Call',
        callee: tok.value,
        calleeSpan: tok.span,
        args,
        span: { from: tok.from, to },
      };
    }
    // Plain identifier
    return { kind: 'Identifier', name: tok.value, span: tok.span };
  }

  // Nothing parseable
  diagnostics.push({
    message: `Expected an expression, got '${tok.value || tok.type}'`,
    severity: 'error',
    from: tok.from,
    to: tok.to,
  });
  return null;
}
