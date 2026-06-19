/**
 * CodeMirror linter powered by fplang analyze().diagnostics.
 *
 * Diagnostics carry { from, to, severity, message } with char offsets —
 * maps directly to CodeMirror's Diagnostic type.
 */

import { linter } from '@codemirror/lint';
import type { Diagnostic as CmDiagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import type { FieldDef } from 'fplang';
import { runAnalyze } from '../fplang.js';

export function fplangLinter(getFields: () => FieldDef[]) {
  return linter((view: EditorView): CmDiagnostic[] => {
    const text   = view.state.doc.toString();
    const fields = getFields();
    if (!text.trim()) return [];

    const { diagnostics } = runAnalyze(text, fields);

    return diagnostics.map(d => ({
      from:     d.from,
      to:       d.to,
      severity: d.severity === 'error' ? 'error' : 'warning',
      message:  d.message,
    }));
  });
}
