import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Editor } from './editor/Editor.js';
import { PlayerTable } from './table/PlayerTable.js';
import { FilterChips } from './table/FilterChips.js';
import { LibraryDrawer } from './library/LibraryDrawer.js';
import { DocsDrawer } from './docs/DocsDrawer.js';
import { FILTER_PRESETS } from './table/filters.js';
import { loadEngine, runEvaluate, runAnalyze } from './fplang.js';
import { autosavePush, autosaveLatest } from './library/storage.js';
import type { EngineState } from './fplang.js';
import type { Panel, Diagnostic } from 'fplang';

const DEFAULT_TEXT = `# Welcome to fplang DataLab
# Start writing factor expressions below.
# Each line: name = expression

xg_over    = goals_scored - expected_goals
value_rank = rank(value, position)
captain    = z(form) + z(fixture_ease) + z(xg_over)
`;

const AUTOSAVE_DEBOUNCE_MS = 30_000;
const EVAL_DEBOUNCE_MS     = 600;

type EvalStatus = 'idle' | 'evaluating' | 'done' | 'error';

export function App() {
  const [engine, setEngine]           = useState<EngineState | null>(null);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [text, setText]               = useState<string>('');
  const [resultPanel, setResultPanel] = useState<Panel | null>(null);
  const [factorNames, setFactorNames] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [evalStatus, setEvalStatus]   = useState<EvalStatus>('idle');
  const [filterId, setFilterId]       = useState('all');
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [docsOpen, setDocsOpen]       = useState(false);
  const [leftWidth, setLeftWidth]     = useState(480);

  const evalTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging       = useRef(false);

  // ── Drag-to-resize ────────────────────────────────────────────────────────────
  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startW = leftWidth;

    function onMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      const newW = Math.max(260, Math.min(window.innerWidth - 260, startW + ev.clientX - startX));
      setLeftWidth(newW);
    }
    function onUp() {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [leftWidth]);

  // ── Boot ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadEngine()
      .then(eng => {
        setEngine(eng);
        const saved = autosaveLatest() ?? DEFAULT_TEXT;
        setText(saved);
      })
      .catch(err => setLoadError(String(err)));
  }, []);

  // ── Evaluate ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!engine) return;
    if (evalTimerRef.current) clearTimeout(evalTimerRef.current);

    setEvalStatus('evaluating');

    evalTimerRef.current = setTimeout(() => {
      const { diagnostics: sema } = runAnalyze(text, engine.fields);
      try {
        const { panel, factorNames: names, diagnostics: rt } = runEvaluate(text, engine.panel, engine.fields);
        setResultPanel(panel);
        setFactorNames(names);
        const allDiags = [...sema, ...rt];
        setDiagnostics(allDiags);
        setEvalStatus(allDiags.some(d => d.severity === 'error') ? 'error' : 'done');
      } catch (err) {
        const errDiag: Diagnostic = {
          message: err instanceof Error ? err.message : String(err),
          severity: 'error', from: 0, to: 0,
        };
        setDiagnostics([...sema, errDiag]);
        setEvalStatus('error');
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
  const handleLoad   = useCallback((t: string) => { setText(t); setDrawerOpen(false); setDocsOpen(false); }, []);

  // ── Filter ────────────────────────────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    if (!resultPanel) return null;
    const preset = FILTER_PRESETS.find(p => p.id === filterId);
    return preset ? preset.apply(resultPanel) : null;
  }, [resultPanel, filterId]);

  // ── Status chip ───────────────────────────────────────────────────────────────
  const statusChip = (() => {
    const visible = visibleRows?.size ?? resultPanel?.rowCount ?? 0;
    const total   = resultPanel?.rowCount ?? 0;
    const errCount = diagnostics.filter(d => d.severity === 'error').length;
    switch (evalStatus) {
      case 'idle':       return { text: '—',                  style: styles.statusIdle };
      case 'evaluating': return { text: 'evaluating…',        style: styles.statusEval };
      case 'error':      return { text: `✗ ${errCount} error${errCount !== 1 ? 's' : ''}`, style: styles.statusError };
      case 'done':       return {
        text: filterId === 'all' ? `✓ ${total} rows` : `✓ ${visible} / ${total} rows`,
        style: styles.statusDone,
      };
    }
  })();

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
        <span style={{ ...styles.statusChip, ...statusChip.style }}>{statusChip.text}</span>
        <span style={styles.bakedAt}>
          snapshot: {new Date(engine.bakedAt).toLocaleDateString()}
        </span>
        <button style={styles.topBtn} onClick={() => { setDocsOpen(o => !o); setDrawerOpen(false); }}>
          {docsOpen ? 'Close docs' : 'Docs'}
        </button>
        <button style={styles.topBtn} onClick={() => { setDrawerOpen(o => !o); setDocsOpen(false); }}>
          {drawerOpen ? 'Close library' : 'Library ▾'}
        </button>
      </header>

      {/* Main content */}
      <div style={styles.main}>
        {/* Left panel */}
        <div style={{ ...styles.left, width: leftWidth }}>
          <div style={styles.editorArea}>
            <Editor value={text} onChange={handleChange} fields={engine.fields} />
          </div>

          {/* Diagnostics */}
          {diagnostics.length > 0 && (
            <div style={styles.diagPanel}>
              {errors.map((d, i) => (
                <div key={i} style={styles.diagItem}>
                  <span style={styles.diagError}>✗</span> {d.message}
                </div>
              ))}
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

        {/* Drag divider */}
        <div style={styles.divider} onMouseDown={onDividerMouseDown} />

        {/* Right panel */}
        <div style={styles.right}>
          {resultPanel ? (
            <>
              <FilterChips
                activeId={filterId}
                onChange={setFilterId}
                visibleCount={visibleRows?.size ?? null}
                totalCount={resultPanel.rowCount}
              />
              <PlayerTable
                panel={resultPanel}
                factorNames={factorNames}
                visibleRows={visibleRows}
              />
            </>
          ) : (
            <div style={styles.center}>
              <p style={{ color: '#9ca3af' }}>Start writing factors on the left to see results.</p>
            </div>
          )}
        </div>
      </div>

      {/* Docs drawer — bottom overlay */}
      {docsOpen && (
        <div style={styles.docsDrawer}>
          <DocsDrawer fields={engine.fields} onLoadExample={handleLoad} />
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root:        { display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#fff' },
  topBar:      { display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 44, borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 },
  logo:        { fontWeight: 700, fontSize: 15, color: '#111827' },
  sourceTag:   { padding: '2px 8px', background: '#e0e7ff', color: '#4f46e5', borderRadius: 99, fontSize: 12, fontWeight: 600 },
  statusChip:  { padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500 },
  statusIdle:  { background: '#f3f4f6', color: '#9ca3af' },
  statusEval:  { background: '#fef3c7', color: '#92400e' },
  statusDone:  { background: '#d1fae5', color: '#065f46' },
  statusError: { background: '#fee2e2', color: '#991b1b' },
  bakedAt:     { fontSize: 12, color: '#9ca3af', marginLeft: 'auto' },
  topBtn:      { padding: '4px 12px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', cursor: 'pointer', fontSize: 13 },
  main:        { display: 'flex', flex: 1, overflow: 'hidden' },
  left:        { minWidth: 260, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' },
  editorArea:  { flex: 1, minHeight: 0, overflow: 'hidden' },
  divider:     { width: 4, cursor: 'col-resize', background: '#e5e7eb', flexShrink: 0, transition: 'background 0.15s' },
  diagPanel:   { maxHeight: 140, overflowY: 'auto', borderTop: '1px solid #fca5a5', background: '#fff5f5', padding: '6px 10px' },
  diagItem:    { fontSize: 12, color: '#374151', padding: '2px 0' },
  diagError:   { color: '#dc2626', marginRight: 4 },
  diagWarn:    { color: '#d97706', marginRight: 4 },
  drawerArea:  { height: 260, borderTop: '1px solid #e5e7eb', flexShrink: 0 },
  right:       { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  center:      { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 },
  docsDrawer:  { height: 320, borderTop: '2px solid #e5e7eb', background: '#fff', flexShrink: 0 },
};
