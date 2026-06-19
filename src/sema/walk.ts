/**
 * Shared AST walker for the sema phase.
 *
 * All recursive expression traversal in depgraph/classify/typecheck goes through
 * here so the switch over Expr.kind lives in one place.
 */

import type { Expr, Call, QualifiedName } from '../parser/ast.js';
import type { SourceSpan } from '../types.js';

export interface NameRef {
  name: string;
  span: SourceSpan;
}

/**
 * Pre-order walk of an expression tree. `visit` is called on every node;
 * returning `false` from `visit` skips descent into that node's children.
 */
export function walkExpr(expr: Expr, visit: (node: Expr) => boolean | void): void {
  const cont = visit(expr);
  if (cont === false) return;

  switch (expr.kind) {
    case 'NumberLit':
    case 'StringLit':
    case 'Identifier':
    case 'QualifiedName':
      break; // leaf nodes — no children to descend into
    case 'Unary':
      walkExpr(expr.expr, visit);
      break;
    case 'Binary':
      walkExpr(expr.left, visit);
      walkExpr(expr.right, visit);
      break;
    case 'Call':
      for (const arg of expr.args) walkExpr(arg, visit);
      break;
  }
}

/**
 * Collect all Identifier nodes reachable from `expr`.
 * Includes identifiers nested inside calls.
 */
export function collectIdentifiers(expr: Expr): NameRef[] {
  const refs: NameRef[] = [];
  walkExpr(expr, node => {
    if (node.kind === 'Identifier') refs.push({ name: node.name, span: node.span });
  });
  return refs;
}

/**
 * Collect all Call nodes reachable from `expr` (pre-order).
 */
export function collectCalls(expr: Expr): Call[] {
  const calls: Call[] = [];
  walkExpr(expr, node => {
    if (node.kind === 'Call') calls.push(node);
  });
  return calls;
}

export interface QualifiedRef {
  source: string;
  field: string;
  span: SourceSpan;
}

/**
 * Collect all QualifiedName nodes reachable from `expr`.
 */
export function collectQualifiedNames(expr: Expr): QualifiedRef[] {
  const refs: QualifiedRef[] = [];
  walkExpr(expr, node => {
    if (node.kind === 'QualifiedName') {
      refs.push({ source: node.source, field: node.field, span: node.span });
    }
  });
  return refs;
}
