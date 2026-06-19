/**
 * Panel merge by join on the `id` column — backlog item 022.
 *
 * mergePanels(base, ...sources) left-joins each source panel onto the base
 * panel using the integer FPL element id as the join key. Columns already
 * present in base are skipped (first-write-wins). Missing rows in a source
 * produce NaN (numeric) or '' (string) in the result.
 */

import { Panel } from './panel.js';

/**
 * Merge one or more source panels into a base panel, joining on the `id` column.
 *
 * Rules:
 * - base must have an `id` column (Float64Array). Throws if not.
 * - Each source panel must also have an `id` column.
 * - For each column in each source (except `id`):
 *   - If the column already exists in the result → skip with console.warn.
 *   - Otherwise append a new column:
 *     - Numeric: per base row, look up base.id[i] in the source; found → copy; missing → NaN.
 *     - String:  per base row, look up base.id[i] in the source; found → copy; missing → ''.
 * - The base panel is not mutated; a new Panel is returned.
 * - The result's `id` column comes from base (canonical).
 */
export function mergePanels(base: Panel, ...sources: Panel[]): Panel {
  // Validate that base has an id column
  const baseId = base.getNumeric('id');
  if (baseId === undefined) {
    throw new Error("mergePanels: base panel must have an 'id' column (Float64Array)");
  }

  const n = base.rowCount;

  // Start with a copy of all base columns
  const init: Record<string, Float64Array | string[]> = {};
  for (const colName of base.columnNames()) {
    const col = base.getColumn(colName);
    if (col instanceof Float64Array) {
      init[colName] = new Float64Array(col);
    } else {
      init[colName] = (col as string[]).slice();
    }
  }

  const result = new Panel(n, init);

  for (const source of sources) {
    const sourceId = source.getNumeric('id');
    if (sourceId === undefined) {
      throw new Error("mergePanels: each source panel must have an 'id' column (Float64Array)");
    }

    // Build index: id value → row index in source
    const sourceRowByid = new Map<number, number>();
    for (let r = 0; r < source.rowCount; r++) {
      const id = sourceId[r];
      if (id !== undefined && isFinite(id)) {
        sourceRowByid.set(id, r);
      }
    }

    for (const colName of source.columnNames()) {
      if (colName === 'id') continue; // base id is canonical

      if (result.has(colName)) {
        console.warn(
          `mergePanels: column '${colName}' already exists in result — skipping (first-write-wins)`,
        );
        continue;
      }

      const srcCol = source.getColumn(colName);
      if (srcCol instanceof Float64Array) {
        // Numeric column
        const newCol = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          const id = baseId[i];
          const srcRow = id !== undefined && isFinite(id) ? sourceRowByid.get(id) : undefined;
          newCol[i] = srcRow !== undefined ? (srcCol[srcRow] ?? NaN) : NaN;
        }
        result.addColumn(colName, newCol);
      } else {
        // String column
        const srcStrCol = srcCol as string[];
        const newCol: string[] = new Array<string>(n);
        for (let i = 0; i < n; i++) {
          const id = baseId[i];
          const srcRow = id !== undefined && isFinite(id) ? sourceRowByid.get(id) : undefined;
          newCol[i] = srcRow !== undefined ? (srcStrCol[srcRow] ?? '') : '';
        }
        result.addColumn(colName, newCol);
      }
    }
  }

  return result;
}
