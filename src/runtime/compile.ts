/**
 * Compile one AST expression into a row closure:
 *   (i: number) => number | string | null
 *
 * The closure closes over the Panel (for column lookups) and the builtin registry.
 * Arithmetic null propagation: any operand that resolves to null → result is null.
 * Comparisons return 1 (true) or 0 (false); null operand → null.
 * Division by zero → null (via sanitize).
 */

import type { Expr } from '../parser/ast.js';
import { Panel } from './panel.js';
import { sanitize } from './values.js';
import { BUILTINS, CONSTANTS, type ScalarValue } from './builtins.js';

export type RowFn = (i: number) => ScalarValue;

/**
 * Compile expr into a row closure.
 * @param expr   The expression AST node.
 * @param panel  The live panel — may grow columns during a session; closure re-reads
 *               columns by name on each invocation so late-bound columns work.
 * @param knownNames  Set of names known at compile time (base fields + defined factors).
 *                    Used to emit an error for unknown identifiers.
 * @returns      A RowFn, or throws if compilation fails.
 */
export function compileExpr(
  expr: Expr,
  panel: Panel,
  knownNames: Set<string>,
): RowFn {
  switch (expr.kind) {
    case 'NumberLit': {
      const v = expr.value;
      return () => v;
    }

    case 'StringLit': {
      const v = expr.value;
      return () => v;
    }

    case 'Identifier': {
      const name = expr.name;
      // Bare constants (assist_points = 3, etc.) — resolve without panel lookup
      if (name in CONSTANTS) {
        const v = CONSTANTS[name]!;
        return () => v;
      }
      if (!knownNames.has(name) && !(name in BUILTINS)) {
        throw new Error(`Unknown name '${name}' at ${expr.span.from}–${expr.span.to}`);
      }
      return (i) => panel.getValue(name, i);
    }

    case 'Unary': {
      const inner = compileExpr(expr.expr, panel, knownNames);
      return (i) => {
        const v = inner(i);
        if (v === null) return null;
        if (typeof v !== 'number') return null;
        return -v;
      };
    }

    case 'Binary': {
      const left  = compileExpr(expr.left,  panel, knownNames);
      const right = compileExpr(expr.right, panel, knownNames);
      const op    = expr.op;

      return (i) => {
        const l = left(i);
        const r = right(i);

        // Equality / inequality also work for strings
        if (op === '==') return l === r ? 1 : 0;
        if (op === '!=') return l !== r ? 1 : 0;

        // All other ops require numbers
        if (l === null || r === null) return null;
        if (typeof l !== 'number' || typeof r !== 'number') return null;

        switch (op) {
          case '+':  return sanitize(l + r);
          case '-':  return sanitize(l - r);
          case '*':  return sanitize(l * r);
          case '/':  return r === 0 ? null : sanitize(l / r);
          case '%':  return r === 0 ? null : sanitize(l % r);
          case '<':  return l < r  ? 1 : 0;
          case '>':  return l > r  ? 1 : 0;
          case '<=': return l <= r ? 1 : 0;
          case '>=': return l >= r ? 1 : 0;
        }
      };
    }

    case 'Call': {
      const fn = BUILTINS[expr.callee];
      if (!fn) {
        // Could be a user-defined factor used as a call — not supported yet
        throw new Error(
          `Unknown function '${expr.callee}' at ${expr.calleeSpan.from}–${expr.calleeSpan.to}`,
        );
      }
      const argFns = expr.args.map(a => compileExpr(a, panel, knownNames));
      return (i) => {
        const args: ScalarValue[] = argFns.map(f => f(i));
        try {
          return fn(args);
        } catch {
          return null;
        }
      };
    }

    case 'QualifiedName': {
      // At runtime, the panel stores columns by their bare FieldDef.name.
      // 'fpl.goals_scored' → column 'goals_scored'; 'understat.xg' → column 'xg'.
      // Sema has already validated source+field; just look up the field name.
      const col = expr.field;
      return (i) => panel.getValue(col, i);
    }
  }
}
