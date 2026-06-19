/**
 * Reconstruct a fplang Panel from the pre-baked panel.json asset.
 *
 * panel.json shape: { rowCount: number, columns: Record<string, (number|null)[]|string[]>, bakedAt: string }
 *
 * null values in numeric arrays → NaN (Panel's null sentinel).
 */

import { Panel } from 'fplang';
import type { ColumnData } from 'fplang';

export interface PanelJson {
  rowCount: number;
  columns: Record<string, (number | null)[] | string[]>;
  bakedAt: string;
}

export function panelFromJson(json: PanelJson): Panel {
  const init: Record<string, ColumnData> = {};

  for (const [name, col] of Object.entries(json.columns)) {
    if (col.length === 0) {
      init[name] = new Float64Array(0);
      continue;
    }
    // Detect type by first element: string[] vs numeric
    if (typeof col[0] === 'string') {
      init[name] = col as string[];
    } else {
      const arr = new Float64Array(col.length);
      for (let i = 0; i < col.length; i++) {
        arr[i] = (col[i] as number | null) ?? NaN;
      }
      init[name] = arr;
    }
  }

  return new Panel(json.rowCount, init);
}
