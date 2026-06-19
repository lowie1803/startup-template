/**
 * Orchestrator: source text → enriched Panel.
 *
 * Pipeline: tokenize → parse → dep graph + topo sort → evaluate in topo order →
 * addColumn to panel (so later defs can reference earlier ones).
 * Numeric results are finalised (sanitize + round6) before storage.
 */

import type { Diagnostic, FieldDef } from '../types.js';
import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { Panel } from './panel.js';
import { finalize } from './values.js';
import { compileExpr, type RowFn } from './compile.js';
import type { ScalarValue } from './builtins.js';
import { buildDepGraph, topoSort, factorNameSet } from '../sema/depgraph.js';
import type { Assignment } from '../parser/ast.js';
import { materializeXS } from './crossSectional.js';

export interface EvaluateResult {
  panel: Panel;
  factorNames: string[];
  diagnostics: Diagnostic[];
}

/**
 * Evaluate factor text against a panel.
 *
 * The input panel is not mutated; a new Panel with the same base columns plus
 * the newly computed factor columns is returned.
 *
 * Factors with cycles are skipped with a diagnostic. Errors in individual
 * factors are collected as diagnostics — evaluation continues with remaining
 * definitions.
 */
export function evaluateFactors(
  text: string,
  panel: Panel,
  fields: FieldDef[],
): EvaluateResult {
  const diagnostics: Diagnostic[] = [];

  // ── Lex ──────────────────────────────────────────────────────────────────
  const { tokens, diagnostics: lexDiags } = tokenize(text);
  diagnostics.push(...lexDiags);

  // ── Parse ─────────────────────────────────────────────────────────────────
  const { defs, diagnostics: parseDiags } = parse(tokens);
  diagnostics.push(...parseDiags);

  if (defs.length === 0) {
    return { panel, factorNames: [], diagnostics };
  }

  // ── Dep graph + topo sort (003) ───────────────────────────────────────────
  const names  = factorNameSet(defs);
  const docOrder = defs.map(d => d.name);
  const graph  = buildDepGraph(defs, names);
  const { order, cycleNodes } = topoSort(graph, docOrder);

  // Cycle diagnostics
  const defByName = new Map<string, Assignment>(defs.map(d => [d.name, d]));
  for (const cycleName of cycleNodes) {
    const def = defByName.get(cycleName);
    if (def) {
      diagnostics.push({
        message: `Cycle detected: '${cycleName}' is part of a circular dependency`,
        severity: 'error',
        from: def.nameSpan.from,
        to: def.nameSpan.to,
      });
    }
  }

  // ── Build working panel (clone: we add columns as factors are defined) ────
  const workingPanel = clonePanel(panel);

  // Track all names visible at each point in evaluation order
  const knownNames = new Set<string>([
    ...fields.map(f => f.name),
    ...panel.columnNames(),
  ]);

  // XS materializer state — unique synthetic column names + cleanup set
  let xsCounter = 0;
  const syntheticNames = new Set<string>();
  function nextXsName(): string {
    const name = `__xs_${xsCounter++}`;
    syntheticNames.add(name);
    return name;
  }

  const factorNames: string[] = [];

  // ── Evaluate each def in topo order, skip cycle members ──────────────────
  for (const name of order) {
    if (cycleNodes.has(name)) continue;

    const def = defByName.get(name);
    if (!def) continue;

    knownNames.add(def.name);

    // Pre-pass: materialise XS calls (rank/z/…) into synthetic columns so
    // the row-wise compiler only sees plain Identifiers.
    let expr = def.expr;
    try {
      expr = materializeXS(expr, workingPanel, knownNames, nextXsName);
    } catch (err) {
      diagnostics.push({
        message: err instanceof Error ? err.message : String(err),
        severity: 'error',
        from: def.expr.span.from,
        to: def.expr.span.to,
      });
      continue;
    }

    let rowFn: RowFn;
    try {
      rowFn = compileExpr(expr, workingPanel, knownNames);
    } catch (err) {
      diagnostics.push({
        message: err instanceof Error ? err.message : String(err),
        severity: 'error',
        from: def.expr.span.from,
        to: def.expr.span.to,
      });
      continue;
    }

    // Determine output type by sampling row 0
    const sample = workingPanel.rowCount > 0 ? rowFn(0) : null;
    const isString = typeof sample === 'string';

    if (isString) {
      // String column
      const col: string[] = [];
      for (let i = 0; i < workingPanel.rowCount; i++) {
        const v = rowFn(i);
        col.push(typeof v === 'string' ? v : '');
      }
      workingPanel.addColumn(def.name, col);
    } else {
      // Numeric column — finalize each value
      const col = new Float64Array(workingPanel.rowCount);
      for (let i = 0; i < workingPanel.rowCount; i++) {
        const v = rowFn(i);
        col[i] = v === null || typeof v !== 'number' ? NaN : finalize(v);
      }
      workingPanel.addColumn(def.name, col);
    }

    factorNames.push(def.name);
  }

  // Strip synthetic XS columns before returning — they are implementation
  // details and must not appear in the public output panel.
  const outputPanel = clonePanelExcluding(workingPanel, syntheticNames);

  return { panel: outputPanel, factorNames, diagnostics };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shallow-clone a Panel (column arrays are shared — they're never mutated). */
function clonePanel(src: Panel): Panel {
  const init: Record<string, Float64Array | string[]> = {};
  for (const name of src.columnNames()) {
    const col = src.getColumn(name);
    if (col !== undefined) init[name] = col;
  }
  return new Panel(src.rowCount, init);
}

/** Like clonePanel but excludes the given names. Used to strip synthetic columns. */
function clonePanelExcluding(src: Panel, exclude: Set<string>): Panel {
  const init: Record<string, Float64Array | string[]> = {};
  for (const name of src.columnNames()) {
    if (exclude.has(name)) continue;
    const col = src.getColumn(name);
    if (col !== undefined) init[name] = col;
  }
  return new Panel(src.rowCount, init);
}
