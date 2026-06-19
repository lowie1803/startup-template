import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from './editor/Editor.js';
import { PlayerTable } from './table/PlayerTable.js';
import { LibraryDrawer } from './library/LibraryDrawer.js';
import { loadEngine, runEvaluate, runAnalyze } from './fplang.js';
import { autosavePush, autosaveLatest } from './library/storage.js';
import type { EngineState } from './fplang.js';
import type { Panel, FieldDef, Diagnostic } from 'fplang';

const DEFAULT_TEXT = `# Welcome to fplang DataLab
# Start writing factor expressions below.
# Each line: name = expression

xg_over    = goals_scored - expected_goals
value_rank = rank(value, position)
captain    = z(form) + z(fixture_ease) + z(xg_over)
`;

const AUTOSAVE_DEBOUNCE_MS = 30_000;
const EVAL_DEBOUNCE_MS     = 600;

export function App() {
  const [engine, setEngine]           = useState<EngineState | null>(null);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [text, setText]               = useState<string>('');
  const [resultPanel, setResultPanel] = useState<Panel | null>(null);
  const [factorNames, setFactorNames] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [drawerOpen, setDrawerOpen]   = useState(false);

  const evalTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Boot: load engine + restore autosave ─────────────────────────────────────
  useEffect(() => {
    loadEngine()
      .then(eng => {
        setEngine(eng);
        const saved = autosaveLatest() ?? DEFAULT_TEXT;
        setText(saved);
      })
      .catch(err => setLoadError(String(err)));
  }, []);

  // ── Evaluate when text or engine changes ─────────────────────────────────────
  useEffect(() => {
    if (!engine) return;
    if (evalTimerRef.current) clearTimeout(evalTimerRef.current);

    evalTimerRef.current = setTimeout(() => {
      // Semantic diagnostics
      const { diagnostics: sema } = runAnalyze(text, engine.fields);

      // Evaluate (always attempt — diagnostics still accumulate)
      try {
        const { panel, factorNames: names, diagnostics: rt } = runEvaluate(text, engine.panel, engine.fields);
        setResultPanel(panel);
        setFactorNames(names);
        setDiagnostics([...sema, ...rt]);
      } catch (err) {
        setDiagnostics([...sema, {
          message: err instanceof Error ? err.message : String(err),
          severity: 'error',
          from: 0,
          to: 0,
        }]);
      }
    }, EVAL_DEBOUNCE_MS);

    return () => { if (evalTimerRef.current) clearTimeout(evalTimerRef.current); };
  }, [text, engine]);

  // ── Auto-save ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => autosavePush(text), AUTOSAVE_DEBOUNCE_MS);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [text]);

  const handleChange = useCallback((t: string) => setText(t), []);
  const handleLoad   = useCallback((t: string) => { setText(t); setDrawerOpen(false); }, []);

  // ── Loading / error ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#dc2626' }}>Failed to load snapshot: {loadError}</p>
        <p style={{ color: '#6b7280', fontSize: 12 }}>Run <code>npm run bake</code> in app-demo/ first.</p>
      </div>
    );
  }

  if (!engine) {
    return <div style={styles.center}><p style={{ color: '#6b7280' }}>Loading snapshot…</p></div>;
  }

  const errors   = diagnostics.filter(d => d.severity === 'error');
  const warnings = diagnostics.filter(d => d.severity === 'warning');

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <header style={styles.topBar}>
        <span style={styles.logo}>⚽ fplang DataLab</span>
        <span style={styles.sourceTag}>fpl</span>
        <span style={styles.bakedAt}>
          snapshot: {new Date(engine.bakedAt).toLocaleDateString()}
        </span>
        <button style={styles.drawerToggle} onClick={() => setDrawerOpen(o => !o)}>
          {drawerOpen ? 'Close library' : 'Library ▾'}
        </button>
      </header>

      {/* Main */}
      <div style={styles.main}>
        {/* Left panel */}
        <div style={styles.left}>
          <div style={styles.editorArea}>
            <Editor
              value={text}
              onChange={handleChange}
              fields={engine.fields}
            />
          </div>

          {/* Diagnostics */}
          {diagnostics.length > 0 && (
            <div style={styles.diagPanel}>
              {errors.length > 0 && (
                <div style={styles.diagErrors}>
                  {errors.map((d, i) => (
                    <div key={i} style={styles.diagItem}>
                      <span style={styles.diagError}>✗</span> {d.message}
                    </div>
                  ))}
                </div>
              )}
              {warnings.map((d, i) => (
                <div key={i} style={styles.diagItem}>
                  <span style={styles.diagWarn}>⚠</span> {d.message}
                </div>
              ))}
            </div>
          )}

          {/* Library drawer */}
          {drawerOpen && (
            <div style={styles.drawerArea}>
              <LibraryDrawer currentText={text} onLoad={handleLoad} />
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={styles.right}>
          {resultPanel && (
            <PlayerTable panel={resultPanel} factorNames={factorNames} />
          )}
          {!resultPanel && (
            <div style={styles.center}>
              <p style={{ color: '#9ca3af' }}>Start writing factors on the left to see results.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root:        { display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#fff' },
  topBar:      { display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 44, borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 },
  logo:        { fontWeight: 700, fontSize: 15, color: '#111827' },
  sourceTag:   { padding: '2px 8px', background: '#e0e7ff', color: '#4f46e5', borderRadius: 99, fontSize: 12, fontWeight: 600 },
  bakedAt:     { fontSize: 12, color: '#9ca3af', marginLeft: 'auto' },
  drawerToggle:{ padding: '4px 12px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', cursor: 'pointer', fontSize: 13 },
  main:        { display: 'flex', flex: 1, overflow: 'hidden' },
  left:        { width: 480, minWidth: 320, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb' },
  editorArea:  { flex: 1, overflow: 'hidden' },
  diagPanel:   { maxHeight: 160, overflowY: 'auto', borderTop: '1px solid #fca5a5', background: '#fff5f5', padding: '6px 10px' },
  diagErrors:  { marginBottom: 4 },
  diagItem:    { fontSize: 12, color: '#374151', padding: '2px 0' },
  diagError:   { color: '#dc2626', marginRight: 4 },
  diagWarn:    { color: '#d97706', marginRight: 4 },
  drawerArea:  { height: 260, borderTop: '1px solid #e5e7eb', flexShrink: 0 },
  right:       { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  center:      { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 },
};
