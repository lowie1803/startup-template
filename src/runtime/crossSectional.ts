/**
 * Cross-sectional (XS) runtime — backlog 010.
 *
 * Two responsibilities:
 *
 * 1. Pure column reducers (Float64Array → Float64Array), each accepting an
 *    optional group-key array. NaN is the null sentinel (matches Panel convention).
 *
 * 2. `materializeXS` — a pre-pass that walks an expression tree, spots XS calls
 *    (rank/z/zscore/quantile/scale/demean), evaluates them column-by-column, stores
 *    the result as a hidden `__xs_N` column in the working panel, and replaces the
 *    original Call node with a plain Identifier that compile.ts can look up per-row.
 *    This lets the existing row-wise compiler handle everything below an XS call.
 *
 * No circular dependency:
 *   crossSectional.ts → compile.ts → builtins.ts (leaf)
 *   evaluate.ts → crossSectional.ts + compile.ts
 */

import type { Expr, Identifier } from '../parser/ast.js';
import { Panel } from './panel.js';
import { compileExpr } from './compile.js';
import { XS_FUNCS } from '../catalog/functions.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a Map<groupKey, index[]> over the rows. */
function groupIndices(n: number, group?: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = group ? (group[i] ?? '__null') : '__all';
    let arr = map.get(key);
    if (!arr) { arr = []; map.set(key, arr); }
    arr.push(i);
  }
  return map;
}

/** Indices in `indices` whose column value is finite (non-null). */
function validIndices(col: Float64Array, indices: number[]): number[] {
  return indices.filter(i => isFinite(col[i]!));
}

function colMean(col: Float64Array, idxs: number[]): number {
  let sum = 0;
  for (const i of idxs) sum += col[i]!;
  return sum / idxs.length;
}

function colPopStd(col: Float64Array, idxs: number[], mean: number): number {
  let sum = 0;
  for (const i of idxs) sum += (col[i]! - mean) ** 2;
  return Math.sqrt(sum / idxs.length);
}

// ── Column reducers ───────────────────────────────────────────────────────────

/**
 * z(expr) / zscore(expr) — population z-score per group.
 * null in → NaN out; std = 0 → result = 0 for all non-null rows in that group.
 */
export function xsZscore(col: Float64Array, group?: string[]): Float64Array {
  const result = new Float64Array(col.length).fill(NaN);
  for (const [, idxs] of groupIndices(col.length, group)) {
    const valid = validIndices(col, idxs);
    if (valid.length === 0) continue;
    const mean = colMean(col, valid);
    const std  = colPopStd(col, valid, mean);
    for (const i of valid) {
      result[i] = std === 0 ? 0 : (col[i]! - mean) / std;
    }
  }
  return result;
}

/**
 * rank(expr) — percentile in [0, 1]; 0 = lowest, 1 = highest.
 * Ties get the average of their rank positions.
 * null in → NaN out; group size 1 → 0.5.
 */
export function xsRank(col: Float64Array, group?: string[]): Float64Array {
  const result = new Float64Array(col.length).fill(NaN);
  for (const [, idxs] of groupIndices(col.length, group)) {
    const valid = validIndices(col, idxs);
    if (valid.length === 0) continue;
    if (valid.length === 1) { result[valid[0]!] = 0.5; continue; }
    // Sort by ascending value
    const sorted = [...valid].sort((a, b) => col[a]! - col[b]!);
    const n = valid.length;
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      const v = col[sorted[i]!];
      while (j < sorted.length && col[sorted[j]!] === v) j++;
      // positions i…j-1 in the sorted order → average percentile
      const pct = ((i + j - 1) / 2) / (n - 1);
      for (let k = i; k < j; k++) result[sorted[k]!] = pct;
      i = j;
    }
  }
  return result;
}

/**
 * quantile(expr) / scale(expr) — min-max scaling to [0, 1].
 * Less sensitive to outliers than zscore.
 * null in → NaN out; max === min → 0.5 for all non-null rows.
 */
export function xsQuantile(col: Float64Array, group?: string[]): Float64Array {
  const result = new Float64Array(col.length).fill(NaN);
  for (const [, idxs] of groupIndices(col.length, group)) {
    const valid = validIndices(col, idxs);
    if (valid.length === 0) continue;
    let min = Infinity, max = -Infinity;
    for (const i of valid) { if (col[i]! < min) min = col[i]!; if (col[i]! > max) max = col[i]!; }
    const range = max - min;
    for (const i of valid) {
      result[i] = range === 0 ? 0.5 : (col[i]! - min) / range;
    }
  }
  return result;
}

/**
 * demean(expr) — subtracts the group mean. Preserves original scale.
 * null in → NaN out.
 */
export function xsDemean(col: Float64Array, group?: string[]): Float64Array {
  const result = new Float64Array(col.length).fill(NaN);
  for (const [, idxs] of groupIndices(col.length, group)) {
    const valid = validIndices(col, idxs);
    if (valid.length === 0) continue;
    const mean = colMean(col, valid);
    for (const i of valid) result[i] = col[i]! - mean;
  }
  return result;
}

/** Map from catalog name to reducer. z and zscore are the same function. scale ≡ quantile. */
export const XS_REDUCERS: Record<string, (col: Float64Array, group?: string[]) => Float64Array> = {
  rank:    xsRank,
  z:       xsZscore,
  zscore:  xsZscore,
  quantile: xsQuantile,
  scale:   xsQuantile,
  demean:  xsDemean,
};

// ── Expression-tree materializer ──────────────────────────────────────────────

/**
 * Pre-pass: walk `expr`, find XS calls, evaluate them as columns against
 * `panel`, register results as hidden `__xs_N` columns, and replace each
 * XS Call node with a plain Identifier.
 *
 * @param expr         Expression to transform (not mutated — new nodes returned).
 * @param panel        The working panel (XS result columns are added to it).
 * @param knownNames   Mutable set of names visible to compile.ts; __xs_N names added.
 * @param nextName     Counter closure → unique name each call.
 * @returns            Transformed expression with no XS Call nodes.
 */
export function materializeXS(
  expr: Expr,
  panel: Panel,
  knownNames: Set<string>,
  nextName: () => string,
): Expr {
  switch (expr.kind) {
    // Leaf nodes — nothing to transform
    case 'NumberLit':
    case 'StringLit':
    case 'Identifier':
    case 'QualifiedName':
      return expr;

    case 'Unary':
      return { ...expr, expr: materializeXS(expr.expr, panel, knownNames, nextName) };

    case 'Binary':
      return {
        ...expr,
        left:  materializeXS(expr.left,  panel, knownNames, nextName),
        right: materializeXS(expr.right, panel, knownNames, nextName),
      };

    case 'Call': {
      // Recurse into args first (handles nested XS: rank(z(form)))
      const transformedArgs = expr.args.map(a =>
        materializeXS(a, panel, knownNames, nextName),
      );

      if (!XS_FUNCS.has(expr.callee)) {
        // Non-XS call: rebuild with transformed args and let compile.ts handle it
        return { ...expr, args: transformedArgs };
      }

      // ── XS call — materialize into a synthetic column ─────────────────────

      // Compile arg0 (already transformed) → Float64Array column
      const arg0Fn = compileExpr(transformedArgs[0]!, panel, knownNames);
      const col = new Float64Array(panel.rowCount);
      for (let i = 0; i < panel.rowCount; i++) {
        const v = arg0Fn(i);
        col[i] = v === null || typeof v !== 'number' ? NaN : v;
      }

      // Optional group arg → string[]
      let group: string[] | undefined;
      if (transformedArgs[1]) {
        const groupFn = compileExpr(transformedArgs[1], panel, knownNames);
        group = [];
        for (let i = 0; i < panel.rowCount; i++) {
          const v = groupFn(i);
          group.push(v === null ? '__null' : String(v));
        }
      }

      // Run the reducer
      const reducer = XS_REDUCERS[expr.callee]!;
      const result = reducer(col, group);

      // Register the result as a synthetic column
      const synName = nextName();
      panel.addColumn(synName, result);
      knownNames.add(synName);

      // Return a plain Identifier in place of the XS call
      const id: Identifier = { kind: 'Identifier', name: synName, span: expr.span };
      return id;
    }
  }
}
