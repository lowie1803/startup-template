/**
 * CodeMirror autocompletion sourced from analyze().completions.
 */

import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { FieldDef } from 'fplang';
import { runAnalyze } from '../fplang.js';

export function fplangCompletion(getFields: () => FieldDef[]) {
  return autocompletion({
    override: [
      (ctx: CompletionContext): CompletionResult | null => {
        const word = ctx.matchBefore(/[a-zA-Z_][a-zA-Z0-9_.]*/) ??
                     ctx.matchBefore(/[a-zA-Z_]/);
        if (!word || (word.from === word.to && !ctx.explicit)) return null;

        const text   = ctx.state.doc.toString();
        const fields = getFields();
        const { completions } = runAnalyze(text, fields);

        return {
          from: word.from,
          options: completions.map(label => ({ label, type: 'variable' })),
        };
      },
    ],
  });
}
