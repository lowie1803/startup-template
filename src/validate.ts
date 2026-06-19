/**
 * Dataset well-formedness validator.
 *
 * validateDataset(schema, panel) enforces the fplang dataset standard
 * (docs/12-dataset-standard.md). A dataset is well-formed iff:
 *
 *   1. Schema complete   — every FieldDef has name, source, type, description, fill.
 *   2. Names well-formed — field names are valid identifiers; no reserved words;
 *                          unique within source; no cross-source column collisions.
 *   3. Shape correct     — every declared field is a column; column lengths match rowCount;
 *                          numeric→Float64Array, string→string[]; id column is present,
 *                          integer-valued, and unique.
 *   4. Density           — no NaN/Inf in any numeric column; no '' in any string column
 *                          (global strict, all rows). Call applyFills() first.
 *   5. Range (warning)   — values outside declared range[] → warning, not error.
 *
 * Usage:
 *   const dense = applyFills(await source.load(), source.fields);
 *   const report = validateDataset(source.fields, dense);
 *   if (!report.ok) console.error(report.errors);
 */

import type { FieldDef } from './types.js';
import type { ValidationReport, Issue } from './sources/types.js';
import { Panel } from './runtime/panel.js';
import { FN_MAP, KNOWN_CONSTANTS } from './catalog/functions.js';

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Validate a panel against its field schema.
 * The panel should already have had applyFills() run on it.
 *
 * @param fields  Field declarations (from one or more DataSource.fields arrays).
 * @param panel   The dense panel to validate.
 */
export function validateDataset(fields: readonly FieldDef[], panel: Panel): ValidationReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  // Rule 1 — schema completeness
  checkSchemaComplete(fields, errors);

  // Rule 2 — name well-formedness
  checkNames(fields, errors);

  // Rule 3 — shape
  checkShape(fields, panel, errors);

  // Rule 4 — density (only meaningful if shape is ok; run anyway for full report)
  checkDensity(fields, panel, errors);

  // Rule 5 — range (warnings)
  checkRanges(fields, panel, warnings);

  return { ok: errors.length === 0, errors, warnings };
}

// ── Rule 1: Schema completeness ───────────────────────────────────────────────

function checkSchemaComplete(fields: readonly FieldDef[], errors: Issue[]): void {
  for (const f of fields) {
    if (!f.name) {
      errors.push({ code: 'SCHEMA_MISSING_NAME', severity: 'error',
        message: 'A FieldDef is missing its name' });
    }
    if (!f.source) {
      errors.push({ code: 'SCHEMA_MISSING_SOURCE', severity: 'error', field: f.name,
        message: `Field '${f.name}' is missing source` });
    }
    if (!f.type) {
      errors.push({ code: 'SCHEMA_MISSING_TYPE', severity: 'error', field: f.name,
        message: `Field '${f.name}' is missing type` });
    }
    if (!f.description || f.description.trim() === '') {
      errors.push({ code: 'SCHEMA_MISSING_DESCRIPTION', severity: 'error', field: f.name,
        message: `Field '${f.name}' has no description — required for the data-source skill` });
    }
    if (!f.fill || !f.fill.kind) {
      errors.push({ code: 'SCHEMA_MISSING_FILL', severity: 'error', field: f.name,
        message: `Field '${f.name}' has no fill policy — declare one so applyFills() can produce a dense column` });
    }
    // mean/median fill don't make sense on string fields
    if (f.type === 'string' && f.fill &&
        (f.fill.kind === 'mean' || f.fill.kind === 'median' || f.fill.kind === 'zero')) {
      errors.push({ code: 'SCHEMA_INVALID_FILL_FOR_STRING', severity: 'error', field: f.name,
        message: `Field '${f.name}' is type 'string' but has numeric fill policy '${f.fill.kind}'` });
    }
  }
}

// ── Rule 2: Name well-formedness ──────────────────────────────────────────────

const VALID_NAME = /^[a-z][a-z0-9_]*$/;
const RESERVED_WORDS = new Set(['series', 'source', 'id', ...FN_MAP.keys(), ...KNOWN_CONSTANTS]);

function checkNames(fields: readonly FieldDef[], errors: Issue[]): void {
  const seenBySource = new Map<string, Set<string>>(); // source → Set<name>
  const allNames = new Set<string>();                  // cross-source collision check

  for (const f of fields) {
    // Pattern
    if (!VALID_NAME.test(f.name)) {
      errors.push({ code: 'NAME_INVALID', severity: 'error', field: f.name,
        message: `Field name '${f.name}' must match /^[a-z][a-z0-9_]*$/` });
    }

    // Reserved (function names, constants, 'source', 'id' is allowed as a column but not as a factor name)
    // 'id' is the join key — it's OK. Only function names / constants are truly reserved.
    if (FN_MAP.has(f.name) || KNOWN_CONSTANTS.has(f.name) || f.name === 'source') {
      errors.push({ code: 'NAME_RESERVED', severity: 'error', field: f.name,
        message: `Field name '${f.name}' is a reserved function or constant name` });
    }

    // Unique within source
    if (!seenBySource.has(f.source)) seenBySource.set(f.source, new Set());
    const sourceNames = seenBySource.get(f.source)!;
    if (sourceNames.has(f.name)) {
      errors.push({ code: 'NAME_DUPLICATE_IN_SOURCE', severity: 'error', field: f.name,
        message: `Field name '${f.name}' appears more than once in source '${f.source}'` });
    }
    sourceNames.add(f.name);

    // Cross-source column collision (the Panel uses bare names as column keys)
    if (allNames.has(f.name) && f.source !== 'fpl') {
      errors.push({ code: 'NAME_CROSS_SOURCE_COLLISION', severity: 'error', field: f.name,
        message: `Field '${f.name}' from source '${f.source}' collides with a field of the same name from another source — rename it` });
    }
    allNames.add(f.name);
  }
}

// ── Rule 3: Shape ─────────────────────────────────────────────────────────────

function checkShape(fields: readonly FieldDef[], panel: Panel, errors: Issue[]): void {
  const { rowCount } = panel;

  for (const f of fields) {
    // Declared field must be a column
    if (!panel.has(f.name)) {
      errors.push({ code: 'SHAPE_MISSING_COLUMN', severity: 'error', field: f.name,
        message: `Column '${f.name}' declared in schema but not present in the panel` });
      continue;
    }

    const col = panel.getColumn(f.name)!;

    // Length check
    if (col.length !== rowCount) {
      errors.push({ code: 'SHAPE_LENGTH_MISMATCH', severity: 'error', field: f.name,
        message: `Column '${f.name}' length ${col.length} ≠ panel.rowCount ${rowCount}` });
    }

    // Type check: numeric/bool → Float64Array; string → string[]
    if (f.type === 'string') {
      if (col instanceof Float64Array) {
        errors.push({ code: 'SHAPE_TYPE_MISMATCH', severity: 'error', field: f.name,
          message: `Field '${f.name}' has type 'string' but the column is a Float64Array` });
      }
    } else {
      // number or bool
      if (!Array.isArray(col)) {
        // Float64Array is not an Array — correct
      } else {
        errors.push({ code: 'SHAPE_TYPE_MISMATCH', severity: 'error', field: f.name,
          message: `Field '${f.name}' has type '${f.type}' but the column is a string[]` });
      }
    }
  }

  // id column: present, integer-valued, unique
  if (!panel.has('id')) {
    errors.push({ code: 'SHAPE_MISSING_ID', severity: 'error',
      message: `Panel is missing the required 'id' column (FPL element id for join)` });
  } else {
    const idCol = panel.getNumeric('id');
    if (!idCol) {
      errors.push({ code: 'SHAPE_ID_NOT_NUMERIC', severity: 'error',
        message: `'id' column must be a Float64Array of FPL element ids` });
    } else {
      const seen = new Set<number>();
      for (let i = 0; i < idCol.length; i++) {
        const v = idCol[i]!;
        if (!isFinite(v) || !Number.isInteger(v)) {
          errors.push({ code: 'SHAPE_ID_NOT_INTEGER', severity: 'error', field: 'id', row: i,
            message: `'id' column row ${i}: ${v} is not a finite integer` });
          break; // report first only
        }
        if (seen.has(v)) {
          errors.push({ code: 'SHAPE_ID_NOT_UNIQUE', severity: 'error', field: 'id', row: i,
            message: `'id' value ${v} is duplicated (first duplicate at row ${i})` });
          break;
        }
        seen.add(v);
      }
    }
  }
}

// ── Rule 4: Density ───────────────────────────────────────────────────────────

function checkDensity(fields: readonly FieldDef[], panel: Panel, errors: Issue[]): void {
  for (const f of fields) {
    if (!panel.has(f.name)) continue; // shape error already reported

    const col = panel.getColumn(f.name)!;

    if (col instanceof Float64Array) {
      // Numeric: no NaN or Inf
      for (let i = 0; i < col.length; i++) {
        if (!isFinite(col[i]!)) {
          errors.push({
            code: 'DENSITY_NAN',
            severity: 'error',
            field: f.name,
            row: i,
            message: `Field '${f.name}' has NaN/Inf at row ${i} — call applyFills() before validate, or change the fill policy`,
          });
          break; // report first offending row only per field
        }
      }
    } else {
      // String: no empty string
      for (let i = 0; i < col.length; i++) {
        if (!col[i]) {
          errors.push({
            code: 'DENSITY_EMPTY_STRING',
            severity: 'error',
            field: f.name,
            row: i,
            message: `Field '${f.name}' has empty string at row ${i}`,
          });
          break;
        }
      }
    }
  }
}

// ── Rule 5: Range (warnings) ──────────────────────────────────────────────────

function checkRanges(fields: readonly FieldDef[], panel: Panel, warnings: Issue[]): void {
  for (const f of fields) {
    if (!f.range || !panel.has(f.name)) continue;
    const [lo, hi] = f.range;
    const col = panel.getNumeric(f.name);
    if (!col) continue;

    for (let i = 0; i < col.length; i++) {
      const v = col[i]!;
      if (isFinite(v) && (v < lo || v > hi)) {
        warnings.push({
          code: 'RANGE_VIOLATION',
          severity: 'warning',
          field: f.name,
          row: i,
          message: `Field '${f.name}' row ${i}: value ${v} is outside declared range [${lo}, ${hi}]`,
        });
        break; // first offender per field
      }
    }
  }
}
