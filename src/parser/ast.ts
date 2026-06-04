import type { SourceSpan } from '../types.js';

// ── Expression nodes ─────────────────────────────────────────────────────────

export interface NumberLit {
  kind: 'NumberLit';
  value: number;
  span: SourceSpan;
}

export interface StringLit {
  kind: 'StringLit';
  value: string;
  span: SourceSpan;
}

export interface Identifier {
  kind: 'Identifier';
  name: string;
  span: SourceSpan;
}

export interface Unary {
  kind: 'Unary';
  op: '-';
  expr: Expr;
  span: SourceSpan;
}

export type BinaryOp =
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '!=' | '<' | '>' | '<=' | '>=';

export interface Binary {
  kind: 'Binary';
  op: BinaryOp;
  left: Expr;
  right: Expr;
  span: SourceSpan;
}

export interface Call {
  kind: 'Call';
  callee: string;
  calleeSpan: SourceSpan;
  args: Expr[];
  span: SourceSpan;
}

/** Union of all expression node types. */
export type Expr =
  | NumberLit
  | StringLit
  | Identifier
  | Unary
  | Binary
  | Call;

// ── Top-level definition ─────────────────────────────────────────────────────

/** One `name = expression` statement. */
export interface Assignment {
  kind: 'Assignment';
  /** The factor name being defined. */
  name: string;
  nameSpan: SourceSpan;
  expr: Expr;
  span: SourceSpan;
}
