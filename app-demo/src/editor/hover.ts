/**
 * CodeMirror hover tooltip sourced from analyze().hoverMap.
 *
 * hoverMap is currently empty (stubbed in src/index.ts — backlog 008 hover pass).
 * The seam is wired here; tooltips populate when the map is filled in a later ticket.
 */

import { hoverTooltip } from '@codemirror/view';
import type { FieldDef } from 'fplang';
import { runAnalyze } from '../fplang.js';

export function fplangHover(getFields: () => FieldDef[]) {
  return hoverTooltip((view, pos) => {
    const text     = view.state.doc.toString();
    const fields   = getFields();
    const { hoverMap } = runAnalyze(text, fields);

    const tip = hoverMap[pos];
    if (!tip) return null;

    return {
      pos,
      create() {
        const dom = document.createElement('div');
        dom.className = 'fplang-hover';
        dom.textContent = tip;
        return { dom };
      },
    };
  });
}
