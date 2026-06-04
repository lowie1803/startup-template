/**
 * Factor classification: scalar / xs / ts / xs+ts.
 * Implements backlog item 004.
 *
 * Classification rules (from docs/06-evaluation Step 3):
 *   - A factor's OWN class is determined by which function families appear in its AST:
 *       XS calls (rank/z/zscore/quantile/scale/demean) → xs bit
 *       TS calls (ts_mean/ts_delta/ts_sum/ts_std/ts_max/ts_min) → ts bit
 *   - Class PROPAGATION: a factor that references another factor inherits (unions in)
 *     that factor's class bits. Computed in topo order so dependencies are already resolved.
 */

import type { Expr } from '../parser/ast.js';
import type { Assignment } from '../parser/ast.js';
import type { FactorClass } from '../index.js';
import { XS_FUNCS, TS_FUNCS } from '../catalog/functions.js';
import { collectCalls } from './walk.js';

interface ClassBits {
  xs: boolean;
  ts: boolean;
}

function bitsToClass(bits: ClassBits): FactorClass {
  if (bits.xs && bits.ts) return 'xs+ts';
  if (bits.xs) return 'xs';
  if (bits.ts) return 'ts';
  return 'scalar';
}

/**
 * Determine the class bits contributed by the expression itself
 * (i.e., ignoring dependencies — just the own AST).
 */
export function classifyExpr(expr: Expr): ClassBits {
  const calls = collectCalls(expr);
  const xs = calls.some(c => XS_FUNCS.has(c.callee));
  const ts = calls.some(c => TS_FUNCS.has(c.callee));
  return { xs, ts };
}

/**
 * Classify all factor definitions, with class propagation through the dep graph.
 *
 * @param defs    All parsed definitions (any order).
 * @param graph   Dep graph: factor name → set of factor names it depends on.
 * @param order   Topo-sorted order (including cycle members appended at end).
 *                We process in this order so a dependency's class is resolved before
 *                its dependents.
 */
export function classifyDefs(
  defs: Assignment[],
  graph: Map<string, Set<string>>,
  order: string[],
): Record<string, FactorClass> {
  // Index defs by name for O(1) lookup
  const defMap = new Map(defs.map(d => [d.name, d]));

  // Accumulated class bits per factor (will be propagated)
  const bits = new Map<string, ClassBits>();

  for (const name of order) {
    const def = defMap.get(name);
    if (!def) continue;

    // Own bits from this factor's expression
    const ownBits = classifyExpr(def.expr);

    // Union in bits from all dependencies (already resolved because we're in topo order)
    const deps = graph.get(name) ?? new Set<string>();
    let xs = ownBits.xs;
    let ts = ownBits.ts;

    for (const dep of deps) {
      const depBits = bits.get(dep);
      if (depBits) {
        xs = xs || depBits.xs;
        ts = ts || depBits.ts;
      }
    }

    bits.set(name, { xs, ts });
  }

  // Build the result record
  const classifications: Record<string, FactorClass> = {};
  for (const [name, b] of bits) {
    classifications[name] = bitsToClass(b);
  }

  return classifications;
}
