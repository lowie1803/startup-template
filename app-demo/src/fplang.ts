/**
 * Thin async wrapper around the fplang engine for use in the browser.
 *
 * Loads pre-baked panel.json + fields.json once, then exposes
 * evaluate() and analyze() over the live Panel and FieldDef catalog.
 */

import { evaluate, analyze, Panel } from 'fplang';
import type { FieldDef, EvalResult, AnalysisResult } from 'fplang';
import { panelFromJson } from './panelFromJson.js';
import type { PanelJson } from './panelFromJson.js';

export interface EngineState {
  panel: Panel;
  fields: FieldDef[];
  bakedAt: string;
}

let _state: EngineState | null = null;

/** Load + reconstruct the snapshot. Call once at app startup. */
export async function loadEngine(): Promise<EngineState> {
  if (_state) return _state;

  const [panelRes, fieldsRes] = await Promise.all([
    fetch('/panel.json'),
    fetch('/fields.json'),
  ]);

  if (!panelRes.ok) throw new Error('Failed to load panel.json');
  if (!fieldsRes.ok) throw new Error('Failed to load fields.json');

  const panelJson: PanelJson = await panelRes.json();
  const fields: FieldDef[]   = await fieldsRes.json();

  _state = {
    panel:   panelFromJson(panelJson),
    fields,
    bakedAt: panelJson.bakedAt,
  };
  return _state;
}

/** Run semantic analysis (lint, completions, classifications). */
export function runAnalyze(text: string, fields: FieldDef[]): AnalysisResult {
  return analyze(text, fields);
}

/** Evaluate factor text against the base panel. Returns enriched panel + factor names. */
export function runEvaluate(text: string, panel: Panel, fields: FieldDef[]): EvalResult {
  return evaluate(text, panel, fields);
}
