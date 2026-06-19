/**
 * The fill step — eliminate NaN/null values from a Panel per each field's FillPolicy.
 *
 * Called between load() and validateDataset() to produce a fully-dense Panel.
 * After applyFills(), a well-formed dataset has zero NaN/Inf in any numeric column
 * and no empty strings in any string column.
 *
 * The source's fillMissing() override (if present) is called AFTER the FillPolicy
 * has been applied, allowing custom logic only where FillPolicy can't express it.
 */

import type { FieldDef, FillPolicy } from '../types.js';
import type { DataSource } from './types.js';
import { Panel } from '../runtime/panel.js';

/**
 * Apply fill policies to a panel, returning a new dense Panel.
 * Columns not listed in `schema.fields` are passed through unchanged.
 *
 * @param panel   The pre-fill panel returned by DataSource.load().
 * @param fields  The field definitions (including FillPolicy for each field).
 * @param source  Optional DataSource — if provided, its fillMissing() override is
 *                called after each policy fill as a final customisation hook.
 */
export function applyFills(
  panel: Panel,
  fields: readonly FieldDef[],
  source?: Pick<DataSource, 'fillMissing'>,
): Panel {
  // Build a working copy of all columns
  const init: Record<string, Float64Array | string[]> = {};
  for (const name of panel.columnNames()) {
    const col = panel.getColumn(name);
    if (col !== undefined) {
      // Clone so we don't mutate the source panel
      init[name] = col instanceof Float64Array ? col.slice() : [...col];
    }
  }

  const fieldMap = new Map(fields.map(f => [f.name, f]));

  for (const [colName, col] of Object.entries(init)) {
    const field = fieldMap.get(colName);
    if (!field) continue; // unlisted columns pass through

    if (col instanceof Float64Array) {
      fillNumeric(col, field.fill);
      if (source?.fillMissing) {
        source.fillMissing(col, field);
      }
    } else {
      fillString(col, field.fill);
    }
  }

  return new Panel(panel.rowCount, init);
}

// ── Numeric fill ──────────────────────────────────────────────────────────────

function fillNumeric(col: Float64Array, policy: FillPolicy): void {
  switch (policy.kind) {
    case 'none':
      // No fill — NaN values will be caught by the validator.
      break;

    case 'zero':
      for (let i = 0; i < col.length; i++) {
        if (!isFinite(col[i]!)) col[i] = 0;
      }
      break;

    case 'constant': {
      const v = typeof policy.value === 'number' ? policy.value : NaN;
      for (let i = 0; i < col.length; i++) {
        if (!isFinite(col[i]!)) col[i] = v;
      }
      break;
    }

    case 'mean': {
      const m = columnMean(col);
      if (isFinite(m)) {
        for (let i = 0; i < col.length; i++) {
          if (!isFinite(col[i]!)) col[i] = m;
        }
      }
      break;
    }

    case 'median': {
      const med = columnMedian(col);
      if (isFinite(med)) {
        for (let i = 0; i < col.length; i++) {
          if (!isFinite(col[i]!)) col[i] = med;
        }
      }
      break;
    }
  }
}

// ── String fill ───────────────────────────────────────────────────────────────

function fillString(col: string[], policy: FillPolicy): void {
  switch (policy.kind) {
    case 'none':
      break; // empty strings caught by validator
    case 'constant': {
      const v = String(policy.value);
      for (let i = 0; i < col.length; i++) {
        if (!col[i]) col[i] = v;
      }
      break;
    }
    // mean/median don't apply to strings; no-op (validator will catch misuse)
    default:
      break;
  }
}

// ── Distribution helpers ──────────────────────────────────────────────────────

function columnMean(col: Float64Array): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < col.length; i++) {
    if (isFinite(col[i]!)) { sum += col[i]!; count++; }
  }
  return count > 0 ? sum / count : NaN;
}

function columnMedian(col: Float64Array): number {
  const finite = Array.from(col).filter(v => isFinite(v)).sort((a, b) => a - b);
  if (finite.length === 0) return NaN;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 === 0
    ? (finite[mid - 1]! + finite[mid]!) / 2
    : finite[mid]!;
}
