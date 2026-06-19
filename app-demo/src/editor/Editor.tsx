import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { FieldDef } from 'fplang';
import { fplangLanguage, fplangHighlightStyle } from './fplangLanguage.js';
import { fplangLinter } from './lint.js';
import { fplangCompletion } from './complete.js';
import { fplangHover } from './hover.js';

interface EditorProps {
  value: string;
  onChange: (text: string) => void;
  fields: FieldDef[];
}

export function Editor({ value, onChange, fields }: EditorProps) {
  const getFields = useMemo(() => () => fields, [fields]);

  const extensions = useMemo(() => [
    fplangLanguage,
    syntaxHighlighting(HighlightStyle.define(fplangHighlightStyle)),
    fplangLinter(getFields),
    fplangCompletion(getFields),
    fplangHover(getFields),
  ], [getFields]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="light"
      style={{ height: '100%', fontSize: 14 }}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        autocompletion: false, // we supply our own
      }}
    />
  );
}
