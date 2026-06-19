/**
 * Shared primitive types used across the engine and the public API.
 * Engine modules import from this file to avoid circular deps with index.ts.
 */

/** Character range within the source text — carried by every token and AST node. */
export interface SourceSpan {
  from: number;
  to: number;
}

/** A diagnostic produced by the parse, sema, or runtime phases. */
export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning';
  from: number;
  to: number;
}

// ── Dataset well-formedness types ─────────────────────────────────────────────

/**
 * How a numeric field's NaN/null values should be eliminated at the fill step
 * to produce a fully-dense column (the well-formedness standard).
 *
 * For string fields `fill: { kind: 'none' }` means the raw data must always
 * be non-empty; `fill: { kind: 'constant', value: 'Unknown' }` fills empties.
 *
 * `mean` and `median` are numeric-only; using them on a string field is a
 * validation error caught by validateDataset().
 */
export type FillPolicy =
  | { kind: 'none' }                        // field is naturally dense; any NaN/'' → error
  | { kind: 'constant'; value: number | string } // replace null/NaN/'' with this value
  | { kind: 'zero' }                        // numeric only: replace NaN with 0
  | { kind: 'mean' }                        // numeric only: fill with column mean of present values
  | { kind: 'median' };                     // numeric only: fill with column median of present values

/**
 * A single field available in a player panel — base data, a prior factor, or a
 * field contributed by a pluggable DataSource.
 *
 * All fields are now required (description, fill, source) so that the dataset
 * well-formedness validator can enforce completeness without special-casing.
 */
export interface FieldDef {
  /** Field name, unique within its source. Used as the Panel column name. */
  name: string;

  /**
   * Source identifier this field belongs to (e.g. 'fpl', 'understat').
   * Corresponds to DataSource.id. The 'fpl' source fields resolve bare
   * in factor expressions; all others require `source.field` syntax.
   */
  source: string;

  /** Value type. */
  type: 'number' | 'string' | 'bool';

  /** Human-readable description — required; drives autocomplete hover + the data-source skill. */
  description: string;

  /**
   * How null/NaN values are eliminated at the fill step before validation.
   * Every field must declare a policy. `none` means the raw data must always
   * be present — any null at that point is a data quality error.
   */
  fill: FillPolicy;

  /** Optional display unit, e.g. '£m', 'per 90', '%'. */
  unit?: string;

  /**
   * Optional sanity bounds [lo, hi] for numeric fields.
   * Values outside produce validation warnings (not errors).
   */
  range?: [number, number];
}
