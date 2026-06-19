/**
 * Typecheck pass — produces span-accurate Diagnostic[] for semantic errors.
 * Implements backlog items 005 and 020.
 *
 * Checks performed (in order):
 *   1. Duplicate factor names
 *   2. Unknown identifiers (not an fpl-source base field, not a factor, not a known constant)
 *   3. Source-reserved bare identifiers (bare use of a source name → "use source.field")
 *   4. Unknown function calls (not in the function catalog)
 *   5. Arity violations
 *   6. series() used outside the first argument of a ts_* call
 *   7. String operands in arithmetic expressions (+, -, *, /, %, unary -)
 *   8. QualifiedName: unknown source or unknown field within source
 */

import type { Assignment, Expr, Binary, QualifiedName } from '../parser/ast.js';
import type { Diagnostic, FieldDef } from '../types.js';
import { FN_MAP, KNOWN_CONSTANTS, TS_FUNCS } from '../catalog/functions.js';
import { findDuplicateNames } from './depgraph.js';
import { walkExpr } from './walk.js';

// ── Type inference (lightweight) ─────────────────────────────────────────────

/**
 * Inferred value type for a single expression — just enough for string-arithmetic checks.
 * 'string' = definitely a string; 'number' = number or unknown; 'series' = a series() call.
 */
type ValType = 'number' | 'string' | 'series';

function inferType(
  expr: Expr,
  fieldTypes: ReadonlyMap<string, 'number' | 'string' | 'bool'>,
  factorTypes: ReadonlyMap<string, ValType>,
): ValType {
  switch (expr.kind) {
    case 'NumberLit': return 'number';
    case 'StringLit': return 'string';
    case 'Identifier': {
      const ft = fieldTypes.get(expr.name);
      if (ft === 'string') return 'string';
      const factType = factorTypes.get(expr.name);
      return factType ?? 'number';
    }
    case 'QualifiedName': return 'number'; // qualified refs are always numeric fields
    case 'Unary': return 'number'; // unary minus only valid on numbers
    case 'Binary': return 'number';
    case 'Call': {
      if (expr.callee === 'series') return 'series';
      return 'number';
    }
  }
}

// ── Main typecheck ────────────────────────────────────────────────────────────

/**
 * Run all typecheck rules over the factor definitions.
 *
 * @param defs        Parsed definitions.
 * @param fields      Base field catalog (all sources).
 * @param factorNames Set of all factor names defined in this document.
 */
export function typecheck(
  defs: Assignment[],
  fields: readonly FieldDef[],
  factorNames: ReadonlySet<string>,
): Diagnostic[] {
  const diags: Diagnostic[] = [];

  // Types map for ALL fields (used by inferType for string-arithmetic checks)
  const fieldTypes = new Map<string, 'number' | 'string' | 'bool'>(
    fields.map(f => [f.name, f.type]),
  );

  // Bare identifier resolution: only fpl-source fields resolve without a prefix
  const fplFieldNames = new Set(
    fields.filter(f => f.source === 'fpl').map(f => f.name),
  );

  // Source → Set<fieldName> map for qualified name resolution (all sources)
  const sourceFieldMap = new Map<string, Set<string>>();
  for (const f of fields) {
    let set = sourceFieldMap.get(f.source);
    if (!set) { set = new Set(); sourceFieldMap.set(f.source, set); }
    set.add(f.name);
  }

  // Known source identifiers (for the "bare source name" check)
  const knownSources = new Set(sourceFieldMap.keys());

  // Track inferred factor types as we process defs (document order approximation)
  const factorTypes = new Map<string, ValType>();

  // 1. Duplicate names
  for (const { name, span } of findDuplicateNames(defs)) {
    diags.push({
      message: `Duplicate factor name '${name}'`,
      severity: 'error',
      from: span.from,
      to: span.to,
    });
  }

  for (const def of defs) {
    checkExpr(
      def.expr,
      fplFieldNames,
      fieldTypes,
      factorNames,
      factorTypes,
      sourceFieldMap,
      knownSources,
      diags,
    );

    // Record this factor's inferred type for downstream factors
    factorTypes.set(def.name, inferType(def.expr, fieldTypes, factorTypes));
  }

  return diags;
}

function checkExpr(
  expr: Expr,
  fplFieldNames: ReadonlySet<string>,
  fieldTypes: ReadonlyMap<string, 'number' | 'string' | 'bool'>,
  factorNames: ReadonlySet<string>,
  factorTypes: ReadonlyMap<string, ValType>,
  sourceFieldMap: ReadonlyMap<string, ReadonlySet<string>>,
  knownSources: ReadonlySet<string>,
  diags: Diagnostic[],
  insideTsFn = false, // are we directly inside a ts_* call's argument list?
  isTsFirstArg = false, // is this the first argument of a ts_* call?
): void {
  switch (expr.kind) {
    case 'NumberLit':
    case 'StringLit':
      break;

    case 'Identifier': {
      const name = expr.name;
      // 3. Bare source name used without a field selector
      if (knownSources.has(name) && !fplFieldNames.has(name) && !factorNames.has(name)) {
        diags.push({
          message: `'${name}' is a source identifier; use ${name}.fieldName`,
          severity: 'error',
          from: expr.span.from,
          to: expr.span.to,
        });
        break;
      }
      // 2. Unknown bare identifier
      if (
        !fplFieldNames.has(name) &&
        !factorNames.has(name) &&
        !KNOWN_CONSTANTS.has(name) &&
        !FN_MAP.has(name)
      ) {
        diags.push({
          message: `Unknown name '${name}'`,
          severity: 'error',
          from: expr.span.from,
          to: expr.span.to,
        });
      }
      break;
    }

    case 'QualifiedName': {
      // 8. Check source + field
      const sourceFields = sourceFieldMap.get(expr.source);
      if (!sourceFields) {
        diags.push({
          message: `Unknown source '${expr.source}'`,
          severity: 'error',
          from: expr.sourceSpan.from,
          to: expr.sourceSpan.to,
        });
      } else if (!sourceFields.has(expr.field)) {
        diags.push({
          message: `Unknown field '${expr.field}' in source '${expr.source}'`,
          severity: 'error',
          from: expr.fieldSpan.from,
          to: expr.fieldSpan.to,
        });
      }
      break;
    }

    case 'Unary': {
      // Unary minus on a string operand is an error
      const operandType = inferType(expr.expr, fieldTypes, factorTypes);
      if (operandType === 'string') {
        diags.push({
          message: `Arithmetic on a string value`,
          severity: 'error',
          from: expr.span.from,
          to: expr.span.to,
        });
      }
      checkExpr(expr.expr, fplFieldNames, fieldTypes, factorNames, factorTypes, sourceFieldMap, knownSources, diags);
      break;
    }

    case 'Binary': {
      checkBinary(expr, fieldTypes, factorTypes, diags);
      checkExpr(expr.left, fplFieldNames, fieldTypes, factorNames, factorTypes, sourceFieldMap, knownSources, diags);
      checkExpr(expr.right, fplFieldNames, fieldTypes, factorNames, factorTypes, sourceFieldMap, knownSources, diags);
      break;
    }

    case 'Call': {
      const sig = FN_MAP.get(expr.callee);

      // 6. series() outside a ts_* first-arg position
      if (expr.callee === 'series' && !isTsFirstArg) {
        diags.push({
          message: `'series()' can only appear as the first argument of a ts_* function`,
          severity: 'error',
          from: expr.span.from,
          to: expr.span.to,
        });
      }

      // 4. Unknown function
      if (!sig) {
        diags.push({
          message: `Unknown function '${expr.callee}'`,
          severity: 'error',
          from: expr.calleeSpan.from,
          to: expr.calleeSpan.to,
        });
        // Still walk args for nested errors
        for (const arg of expr.args) {
          checkExpr(arg, fplFieldNames, fieldTypes, factorNames, factorTypes, sourceFieldMap, knownSources, diags);
        }
        break;
      }

      // 5. Arity
      const { minArgs, maxArgs } = sig;
      if (expr.args.length < minArgs || expr.args.length > maxArgs) {
        const range = maxArgs === Infinity
          ? `at least ${minArgs}`
          : minArgs === maxArgs ? `exactly ${minArgs}` : `${minArgs}–${maxArgs}`;
        diags.push({
          message: `'${expr.callee}' expects ${range} argument(s), got ${expr.args.length}`,
          severity: 'error',
          from: expr.span.from,
          to: expr.span.to,
        });
      }

      // Walk arguments, marking the first arg of a ts_* as isTsFirstArg
      const isTsFn = TS_FUNCS.has(expr.callee);
      for (let i = 0; i < expr.args.length; i++) {
        const isFirst = i === 0;
        checkExpr(
          expr.args[i]!,
          fplFieldNames,
          fieldTypes,
          factorNames,
          factorTypes,
          sourceFieldMap,
          knownSources,
          diags,
          isTsFn,       // insideTsFn
          isTsFn && isFirst, // isTsFirstArg
        );
      }
      break;
    }
  }
}

const ARITHMETIC_OPS = new Set(['+', '-', '*', '/', '%']);

function checkBinary(
  expr: Binary,
  fieldTypes: ReadonlyMap<string, 'number' | 'string' | 'bool'>,
  factorTypes: ReadonlyMap<string, ValType>,
  diags: Diagnostic[],
): void {
  // Equality/inequality are allowed on strings — only flag arithmetic ops
  if (!ARITHMETIC_OPS.has(expr.op)) return;

  const leftType  = inferType(expr.left,  fieldTypes, factorTypes);
  const rightType = inferType(expr.right, fieldTypes, factorTypes);

  if (leftType === 'string' || rightType === 'string') {
    diags.push({
      message: `Arithmetic on a string value (operator '${expr.op}')`,
      severity: 'error',
      from: expr.span.from,
      to: expr.span.to,
    });
  }
}
