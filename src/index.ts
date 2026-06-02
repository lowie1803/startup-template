/**
 * fplang — factor / alpha expression language for FPL analytics.
 *
 * Public API — the editor substrate consumed by CodeMirror (lint, hover, autocomplete)
 * and the CLI/REPL/backtest runner.
 *
 * STATUS: contract stubs. Engine implementation pending (see backlog items 001-007).
 * `parse()`, `analyze()`, and `evaluate()` throw until the engine is wired.
 * `listFields()` returns [] (safe empty catalog; filled by catalog/fields.ts later).
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Character range within the source text — carried by every token and AST node. */
export interface SourceSpan {
  from: number;
  to: number;
}

/** A diagnostic produced by the parse, sema, or runtime phases. Carries a span
 *  so the editor can underline the offending characters. */
export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning';
  from: number;
  to: number;
}

// ---------------------------------------------------------------------------
// Field catalog
// ---------------------------------------------------------------------------

/** A single field available in the player panel (base data or a prior factor). */
export interface FieldDef {
  name: string;
  type: 'number' | 'string' | 'bool';
  description?: string;
}

// ---------------------------------------------------------------------------
// Columnar data model (defined fully in runtime/panel.ts later)
// ---------------------------------------------------------------------------

/**
 * A data panel — one row per player.
 * Numeric fields: Float64Array; categorical: string[]; history: Arrow ListArray shape.
 * Typed properly once runtime/panel.ts exists.
 */
export interface Panel {
  [field: string]: unknown;
}

// ---------------------------------------------------------------------------
// parse()
// ---------------------------------------------------------------------------

/** Raw AST definition node — typed fully once parser/ast.ts exists. */
export type AssignmentNode = unknown;

export interface ParseResult {
  /** One entry per `name = expression` line, in document order. */
  defs: AssignmentNode[];
  /** Parse errors with character ranges. */
  diagnostics: Diagnostic[];
}

/**
 * Lex + parse only — no semantic analysis or evaluation.
 * Fast enough to run on every keystroke.
 * Returns span-annotated AST nodes + parse diagnostics.
 *
 * @throws {Error} 'fplang engine not yet implemented' — until lexer/parser are built.
 */
export function parse(_text: string): ParseResult {
  throw new Error('fplang engine not yet implemented');
}

// ---------------------------------------------------------------------------
// analyze()
// ---------------------------------------------------------------------------

/** Factor evaluation class assigned by the sema phase. */
export type FactorClass = 'scalar' | 'xs' | 'ts' | 'xs+ts';

export interface AnalysisResult {
  /** Factor names in safe evaluation order (topological sort, cycles excluded). */
  order: string[];
  /** Semantic + type diagnostics (undefined names, series misuse, cycles, …). */
  diagnostics: Diagnostic[];
  /** Evaluation class per factor name, after cross-factor class propagation. */
  classifications: Record<string, FactorClass>;
  /** char-offset → hover text for the editor tooltip layer. */
  hoverMap: Record<number, string>;
  /** Names valid for autocomplete at any position (base fields + in-scope factors). */
  completions: string[];
}

/**
 * Full semantic analysis without evaluation.
 * Run on parse success to feed the editor: lint underlines, hover, autocomplete.
 *
 * @param text   Factor source text.
 * @param fields Field catalog — base data fields available in the panel.
 * @throws {Error} 'fplang engine not yet implemented' — until sema phase is built.
 */
export function analyze(_text: string, _fields: FieldDef[]): AnalysisResult {
  throw new Error('fplang engine not yet implemented');
}

// ---------------------------------------------------------------------------
// evaluate()
// ---------------------------------------------------------------------------

export interface EvalResult {
  /** Input panel extended with one new column per successfully evaluated factor. */
  panel: Panel;
  /** Names of the factor columns added (in evaluation order). */
  factorNames: string[];
  /** Runtime diagnostics (type errors discovered during eval, null propagation notes, …). */
  diagnostics: Diagnostic[];
}

/**
 * Full evaluation: parse → sema → compile → run.
 * Returns the enriched panel with factor columns appended.
 * Factor values are rounded to 6 decimal places at the boundary.
 * Infinity / NaN / ÷0 → null. Null propagates through arithmetic.
 *
 * @param text   Factor source text.
 * @param panel  Columnar player panel (base data).
 * @param fields Field catalog matching the panel.
 * @throws {Error} 'fplang engine not yet implemented' — until runtime is built.
 */
export function evaluate(
  _text: string,
  _panel: Panel,
  _fields: FieldDef[],
): EvalResult {
  throw new Error('fplang engine not yet implemented');
}

// ---------------------------------------------------------------------------
// listFields()
// ---------------------------------------------------------------------------

/**
 * Returns the vendored field catalog (base FPL fields available in the panel).
 * Safe stub returns [] until catalog/fields.ts is populated.
 * Future: returns the full list from src/catalog/fields.ts.
 */
export function listFields(): FieldDef[] {
  return [];
}
