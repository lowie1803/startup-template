/**
 * Contracts for pluggable data sources and the dataset well-formedness system.
 *
 * See docs/11-data-sources.md for the architecture overview.
 * See docs/12-dataset-standard.md for the validation rules.
 * See ADR-002 for the design decision record.
 */

import type { FieldDef } from '../types.js';
import type { Panel } from '../runtime/panel.js';

// ── DataSource contract ───────────────────────────────────────────────────────

/**
 * A pluggable data source.
 *
 * Each source is an independent module (typically a separate repo) that knows
 * how to fetch/read its raw data, normalise it to FPL element ids, and return
 * a columnar Panel ready for merging.
 *
 * The source owns:
 *   - Its field schema (names, types, descriptions, fill policies)
 *   - Its loading and reformatting logic
 *   - Its missing-data policy (via fill or fillMissing override)
 *   - Any static scaling coefficients it applies to its values
 *
 * fplang core owns:
 *   - Merging source panels (join on integer id)
 *   - Running the fill step (applyFills)
 *   - Validating the merged dense panel (validateDataset)
 */
export interface DataSource {
  /**
   * Short identifier, used as the namespace prefix in factor expressions.
   * Must match `^[a-z][a-z0-9_]*$` and be unique across all active sources.
   * The 'fpl' source is built-in and its fields resolve bare in expressions.
   */
  id: string;

  /**
   * Field declarations for this source.
   * Every FieldDef must carry source === this.id and a fill policy.
   * Declared upfront so sema and autocomplete know the full catalog without
   * having to call load().
   */
  fields: FieldDef[];

  /**
   * Load raw data and return it as a pre-fill columnar Panel.
   *
   * Contract:
   * - Column names match the `name` in each FieldDef.
   * - Every row corresponds to a player identified by FPL element id.
   * - The panel MUST include an `id` column (Float64Array of FPL element ids)
   *   for the core merge step (mergePanels).
   * - Normalising to FPL element ids is the source's responsibility;
   *   fplang core does only integer equality for the join.
   * - The returned panel is the *pre-fill* state — NaN values are allowed
   *   here; the fill step (applyFills) will eliminate them per each field's
   *   FillPolicy before validation.
   */
  load(opts?: Record<string, unknown>): Panel | Promise<Panel>;

  /**
   * Optional: override the FillPolicy-based fill for a specific column.
   * Called by applyFills() after the policy default has been applied,
   * so only custom behaviour that can't be expressed as a FillPolicy
   * needs to go here. The col array is a Float64Array clone; mutate it.
   */
  fillMissing?(col: Float64Array, field: FieldDef): void;

  /**
   * Optional: static multipliers applied per-field after load() and before fill.
   * e.g. { raw_xg: 1.12 } scales the raw_xg column by 1.12.
   * Useful when a third-party source's raw values need unit alignment.
   */
  coefficients?: Record<string, number>;
}

// ── Schema ────────────────────────────────────────────────────────────────────

/**
 * The field schema for a single source — used as a lightweight reference
 * when you need the metadata but not the load() implementation.
 */
export interface DatasetSchema {
  /** Source identifier — matches DataSource.id. */
  source: string;
  /** All fields declared by this source. */
  fields: FieldDef[];
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * A single validation finding (error or warning) from validateDataset().
 */
export interface Issue {
  /** Short machine-readable code, e.g. 'DENSITY_NAN', 'SCHEMA_MISSING_FILL'. */
  code: string;
  /** Severity level. */
  severity: 'error' | 'warning';
  /** The field name the finding applies to, if field-specific. */
  field?: string;
  /** The first row index where the finding occurs, if row-specific. */
  row?: number;
  /** Human-readable description. */
  message: string;
}

/**
 * The result of validateDataset(schema, panel).
 * ok === true iff errors is empty (warnings do not affect ok).
 */
export interface ValidationReport {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}
