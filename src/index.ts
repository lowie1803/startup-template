/**
 * fplang — factor / alpha expression language for FPL analytics.
 *
 * Public API — the editor substrate consumed by CodeMirror (lint, hover, autocomplete)
 * and the CLI/REPL/backtest runner.
 */

// ── Re-export shared primitives ───────────────────────────────────────────────
export type { SourceSpan, Diagnostic, FieldDef } from './types.js';

// ── Re-export AST types ───────────────────────────────────────────────────────
export type { Assignment, Expr } from './parser/ast.js';

// ── Re-export Panel ───────────────────────────────────────────────────────────
export { Panel } from './runtime/panel.js';
export type { ColumnData } from './runtime/panel.js';

// ── Internal imports (not re-exported) ───────────────────────────────────────
import { tokenize } from './lexer/lexer.js';
import { parse as _parse } from './parser/parser.js';
import { evaluateFactors } from './runtime/evaluate.js';
import { FPL_FIELDS } from './catalog/fields.js';
import { FN_MAP, KNOWN_CONSTANTS } from './catalog/functions.js';
import { buildDepGraph, topoSort, factorNameSet } from './sema/depgraph.js';
import { classifyDefs } from './sema/classify.js';
import { typecheck } from './sema/typecheck.js';

import type { SourceSpan, Diagnostic, FieldDef } from './types.js';
import type { Assignment } from './parser/ast.js';
import type { Panel } from './runtime/panel.js';

// ── Public result types ───────────────────────────────────────────────────────

export interface ParseResult {
  /** One entry per `name = expression` line, in document order. */
  defs: Assignment[];
  /** Parse errors with character ranges. */
  diagnostics: Diagnostic[];
}

/** Factor evaluation class assigned by the sema phase. */
export type FactorClass = 'scalar' | 'xs' | 'ts' | 'xs+ts';

export interface AnalysisResult {
  /** Factor names in safe evaluation order (topo-sorted, document order for ties). */
  order: string[];
  /** Semantic + type diagnostics (undefined names, cycles, arity errors, …). */
  diagnostics: Diagnostic[];
  /** Evaluation class per factor name. */
  classifications: Record<string, FactorClass>;
  /** char-offset → hover text (minimal — full hover is backlog 008). */
  hoverMap: Record<number, string>;
  /** Names valid for autocomplete: base fields + defined factors + known functions. */
  completions: string[];
}

export interface EvalResult {
  /** Input panel extended with one new column per successfully evaluated factor. */
  panel: Panel;
  /** Names of the factor columns added (in evaluation order). */
  factorNames: string[];
  /** Runtime diagnostics. */
  diagnostics: Diagnostic[];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Lex + parse only — no semantic analysis or evaluation.
 * Fast enough to run on every keystroke.
 * Returns span-annotated AST nodes + parse diagnostics.
 */
export function parse(text: string): ParseResult {
  const { tokens, diagnostics: lexDiags } = tokenize(text);
  const { defs, diagnostics: parseDiags } = _parse(tokens);
  return { defs, diagnostics: [...lexDiags, ...parseDiags] };
}

/**
 * Full semantic analysis without evaluation.
 * - Builds the dependency graph and topological sort.
 * - Classifies each factor (scalar/xs/ts/xs+ts) with class propagation.
 * - Reports undefined-name, cycle, arity, type, and duplicate diagnostics.
 * - Returns completions including all known function names.
 */
export function analyze(text: string, fields: FieldDef[]): AnalysisResult {
  const { tokens, diagnostics: lexDiags } = tokenize(text);
  const { defs, diagnostics: parseDiags } = _parse(tokens);

  const allDiags: Diagnostic[] = [...lexDiags, ...parseDiags];

  if (defs.length === 0) {
    const completions = [
      ...fields.map(f => f.name),
      ...Array.from(FN_MAP.keys()),
      ...Array.from(KNOWN_CONSTANTS),
    ];
    return {
      order: [],
      diagnostics: allDiags,
      classifications: {},
      hoverMap: {},
      completions,
    };
  }

  const names = factorNameSet(defs);
  const docOrder = defs.map(d => d.name);

  // 1. Dep graph + topo sort + cycle detection (003)
  const graph  = buildDepGraph(defs, names);
  const { order, cycleNodes } = topoSort(graph, docOrder);

  // Cycle diagnostics — one error per cycle member at its nameSpan
  for (const def of defs) {
    if (cycleNodes.has(def.name)) {
      allDiags.push({
        message: `Cycle detected: '${def.name}' is part of a circular dependency`,
        severity: 'error',
        from: def.nameSpan.from,
        to: def.nameSpan.to,
      });
    }
  }

  // 2. Classify (004)
  const classifications = classifyDefs(defs, graph, order);

  // 3. Typecheck (005)
  const typeDiags = typecheck(defs, fields, names);
  allDiags.push(...typeDiags);

  // Completions: base fields + factor names + function catalog + constants
  const completions: string[] = [
    ...fields.map(f => f.name),
    ...docOrder,
    ...Array.from(FN_MAP.keys()),
    ...Array.from(KNOWN_CONSTANTS),
  ];

  return {
    order,
    diagnostics: allDiags,
    classifications,
    hoverMap: {},
    completions,
  };
}

/**
 * Full evaluation: parse → compile → run.
 * Returns the enriched panel with factor columns appended.
 */
export function evaluate(text: string, panel: Panel, fields: FieldDef[]): EvalResult {
  const { panel: outPanel, factorNames, diagnostics } = evaluateFactors(text, panel, fields);
  return { panel: outPanel, factorNames, diagnostics };
}

/**
 * Returns the vendored FPL field catalog.
 */
export function listFields(): FieldDef[] {
  return FPL_FIELDS;
}
