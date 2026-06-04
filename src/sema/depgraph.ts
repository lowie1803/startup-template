/**
 * Dependency graph, topological sort, and cycle detection for factor definitions.
 * Implements backlog item 003.
 *
 * A directed edge A → B means "A depends on B" (B must be evaluated before A).
 * Kahn's algorithm is used for the topo sort; cycle nodes are any factor with
 * non-zero in-degree after the queue drains.
 */

import type { Assignment } from '../parser/ast.js';
import type { SourceSpan } from '../types.js';
import { collectIdentifiers } from './walk.js';
import { FN_MAP, KNOWN_CONSTANTS } from '../catalog/functions.js';

export interface NameRef {
  name: string;
  span: SourceSpan;
}

/**
 * Build the dependency map.
 * For each factor definition, deps = the set of *other factor names* (not base
 * fields, not builtins/functions, not constants) that appear in the expression.
 *
 * @param defs        Parsed factor definitions (any order).
 * @param factorNames Set of all factor names defined in this document (pre-computed).
 */
export function buildDepGraph(
  defs: Assignment[],
  factorNames: ReadonlySet<string>,
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const def of defs) {
    const deps = new Set<string>();
    for (const { name } of collectIdentifiers(def.expr)) {
      // Only factor-to-factor edges; base fields and functions are not in the graph.
      // Self-references (a = a + 1) are included so Kahn's algo detects them as cycles.
      if (factorNames.has(name)) {
        deps.add(name);
      }
    }
    graph.set(def.name, deps);
  }

  return graph;
}

export interface TopoResult {
  /** Factor names in safe evaluation order. Cycle members are appended at the end. */
  order: string[];
  /** Names of factors involved in a cycle (cannot be safely evaluated). */
  cycleNodes: Set<string>;
}

/**
 * Topological sort via Kahn's algorithm.
 *
 * @param graph       Dep graph from `buildDepGraph`.
 * @param docOrder    Factor names in document order (used to seed the ready queue
 *                    deterministically so independent factors keep source order).
 */
export function topoSort(
  graph: Map<string, Set<string>>,
  docOrder: string[],
): TopoResult {
  // Build in-degree map (how many factors this factor depends on)
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, Set<string>>(); // reverse: who depends on me?

  for (const name of docOrder) {
    if (!inDegree.has(name)) inDegree.set(name, 0);
    if (!dependents.has(name)) dependents.set(name, new Set());
  }

  for (const [name, deps] of graph) {
    inDegree.set(name, deps.size);
    for (const dep of deps) {
      if (!dependents.has(dep)) dependents.set(dep, new Set());
      dependents.get(dep)!.add(name);
    }
  }

  // Seed queue with zero-in-degree nodes in document order
  const ready: string[] = docOrder.filter(n => (inDegree.get(n) ?? 0) === 0);
  const result: string[] = [];

  while (ready.length > 0) {
    // Stable: take from the front (document order was the seed order)
    const node = ready.shift()!;
    result.push(node);

    // Reduce in-degree of nodes that depend on this one
    const revDeps = dependents.get(node) ?? new Set<string>();
    // Iterate in document order for stable output
    for (const dep of docOrder) {
      if (!revDeps.has(dep)) continue;
      const newDeg = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) ready.push(dep);
    }
  }

  // Any node not in result has non-zero in-degree → cycle
  const cycleNodes = new Set<string>(
    docOrder.filter(n => !result.includes(n)),
  );

  // Append cycle members in doc order so callers can still iterate over all defs
  for (const n of docOrder) {
    if (cycleNodes.has(n)) result.push(n);
  }

  return { order: result, cycleNodes };
}

/**
 * Find factor names defined more than once.
 * Returns one NameRef per duplicate occurrence (all after the first).
 */
export function findDuplicateNames(defs: Assignment[]): NameRef[] {
  const seen = new Set<string>();
  const dupes: NameRef[] = [];
  for (const def of defs) {
    if (seen.has(def.name)) {
      dupes.push({ name: def.name, span: def.nameSpan });
    } else {
      seen.add(def.name);
    }
  }
  return dupes;
}

/**
 * Build the set of all unique factor names from a list of definitions.
 * Duplicates collapse — the set contains each name once.
 */
export function factorNameSet(defs: Assignment[]): Set<string> {
  return new Set(defs.map(d => d.name));
}

/**
 * Determine whether a name is a "known external" (base field, function, or constant)
 * that should NOT be treated as a factor dependency.
 *
 * Used by buildDepGraph and typecheck to distinguish factor references from
 * field/builtin references.
 */
export function isKnownExternal(
  name: string,
  fieldNames: ReadonlySet<string>,
): boolean {
  return fieldNames.has(name) || FN_MAP.has(name) || KNOWN_CONSTANTS.has(name);
}
