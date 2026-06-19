import React, { useState, useEffect } from 'react';
import {
  libraryList,
  librarySave,
  libraryLoad,
  libraryDelete,
  downloadFactors,
  autosaveList,
} from './storage.js';
import type { NamedLibrary, AutosaveEntry } from './storage.js';

interface LibraryDrawerProps {
  currentText: string;
  onLoad: (text: string) => void;
}

export function LibraryDrawer({ currentText, onLoad }: LibraryDrawerProps) {
  const [tab, setTab]         = useState<'saved' | 'history'>('saved');
  const [libraries, setLibs]  = useState<NamedLibrary[]>([]);
  const [history, setHistory] = useState<AutosaveEntry[]>([]);
  const [saveName, setSaveName] = useState('');

  function refresh() {
    setLibs(libraryList());
    setHistory(autosaveList());
  }

  useEffect(() => { refresh(); }, []);

  function handleSave() {
    const name = saveName.trim();
    if (!name) return;
    librarySave(name, currentText);
    setSaveName('');
    refresh();
  }

  function handleDelete(name: string) {
    libraryDelete(name);
    refresh();
  }

  function handleDownload(lib: NamedLibrary) {
    downloadFactors(lib.name, lib.text);
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div style={styles.drawer}>
      {/* Save row */}
      <div style={styles.saveRow}>
        <input
          style={styles.input}
          placeholder="Library name…"
          value={saveName}
          onChange={e => setSaveName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <button style={styles.btn} onClick={handleSave} disabled={!saveName.trim()}>
          Save
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['saved', 'history'] as const).map(t => (
          <button
            key={t}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => { setTab(t); refresh(); }}
          >
            {t === 'saved' ? `Saved (${libraries.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={styles.list}>
        {tab === 'saved' && libraries.length === 0 && (
          <p style={styles.empty}>No saved libraries yet.</p>
        )}

        {tab === 'saved' && libraries.map(lib => (
          <div key={lib.name} style={styles.item}>
            <div style={styles.itemMain}>
              <span style={styles.itemName}>{lib.name}</span>
              <span style={styles.itemDate}>{fmtDate(lib.savedAt)}</span>
            </div>
            <div style={styles.itemActions}>
              <button style={styles.btnSm} onClick={() => onLoad(lib.text)}>Load</button>
              <button style={styles.btnSm} onClick={() => handleDownload(lib)}>↓</button>
              <button style={{ ...styles.btnSm, color: '#dc2626' }} onClick={() => handleDelete(lib.name)}>✕</button>
            </div>
          </div>
        ))}

        {tab === 'history' && history.length === 0 && (
          <p style={styles.empty}>No auto-save history yet.</p>
        )}

        {tab === 'history' && history.map((entry, i) => (
          <div key={entry.ts} style={styles.item}>
            <div style={styles.itemMain}>
              <span style={styles.itemName}>{i === 0 ? 'Latest' : `#${i + 1}`}</span>
              <span style={styles.itemDate}>{fmtDate(entry.ts)}</span>
            </div>
            <div style={styles.itemActions}>
              <button style={styles.btnSm} onClick={() => onLoad(entry.text)}>Load</button>
              <button style={styles.btnSm} onClick={() => downloadFactors(`draft-${i + 1}`, entry.text)}>↓</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  drawer:    { display: 'flex', flexDirection: 'column', height: '100%', background: '#f9fafb', borderTop: '1px solid #e5e7eb' },
  saveRow:   { display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid #e5e7eb' },
  input:     { flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 },
  btn:       { padding: '4px 12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 },
  tabs:      { display: 'flex', borderBottom: '1px solid #e5e7eb' },
  tab:       { flex: 1, padding: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6b7280' },
  tabActive: { borderBottom: '2px solid #4f46e5', color: '#4f46e5', fontWeight: 600 },
  list:      { flex: 1, overflowY: 'auto', padding: '4px 0' },
  empty:     { padding: '12px', color: '#9ca3af', fontSize: 13, textAlign: 'center' },
  item:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #f3f4f6' },
  itemMain:  { display: 'flex', flexDirection: 'column', gap: 1 },
  itemName:  { fontSize: 13, fontWeight: 600, color: '#111827' },
  itemDate:  { fontSize: 11, color: '#9ca3af' },
  itemActions: { display: 'flex', gap: 4 },
  btnSm:     { padding: '2px 8px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
};
