import React, { useState, useEffect } from 'react';
import type { FieldDef } from 'fplang';

interface DocsDrawerProps {
  fields: FieldDef[];
  onLoadExample: (text: string) => void;
}

interface Example { name: string; text: string; }

type Tab = 'howto' | 'functions' | 'fields' | 'examples';

export function DocsDrawer({ fields, onLoadExample }: DocsDrawerProps) {
  const [tab, setTab]         = useState<Tab>('howto');
  const [examples, setExamples] = useState<Example[]>([]);

  useEffect(() => {
    fetch('/examples.json')
      .then(r => r.json())
      .then((ex: Example[]) => setExamples(ex))
      .catch(() => {/* silently ignore if not baked */});
  }, []);

  return (
    <div style={styles.drawer}>
      <div style={styles.tabs}>
        {([
          ['howto',     'How to use'],
          ['functions', 'Functions & operators'],
          ['fields',    'Fields'],
          ['examples',  'Examples'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            style={{ ...styles.tab, ...(tab === id ? styles.tabActive : {}) }}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.body}>
        {tab === 'howto'     && <HowToUse />}
        {tab === 'functions' && <FunctionsRef />}
        {tab === 'fields'    && <FieldsRef fields={fields} />}
        {tab === 'examples'  && <ExamplesTab examples={examples} onLoad={onLoadExample} />}
      </div>
    </div>
  );
}

// ── How to use ────────────────────────────────────────────────────────────────

function HowToUse() {
  return (
    <div style={styles.content}>
      <h3 style={styles.h3}>DataLab UI guide</h3>
      <Section title="Top bar">
        <Item label="⚽ fplang DataLab">App title.</Item>
        <Item label="fpl (blue chip)">Active data source. More sources can be added via sources.config.ts.</Item>
        <Item label="Status chip">Shows evaluation state: <Code>evaluating…</Code> while computing, <Code>✓ N rows</Code> when done, <Code>✗ N error(s)</Code> if there are parse/runtime errors.</Item>
        <Item label="snapshot: date">Date the FPL data was last baked from the API. Re-run <Code>npm run bake</Code> to refresh.</Item>
        <Item label="Library button">Opens the factor library drawer at the bottom of the editor panel. Save, load, and download .factors files.</Item>
        <Item label="Docs button">Opens this docs drawer.</Item>
      </Section>
      <Section title="Left panel — Editor">
        <Item label="Editor">Write factor expressions here. One per line: <Code>name = expression</Code>. Evaluation runs automatically 600ms after you stop typing.</Item>
        <Item label="Syntax highlighting">Keywords (functions) are purple, numbers green, strings amber, comments grey.</Item>
        <Item label="Autocomplete">Press <Code>Ctrl+Space</Code> to trigger. Completes field names, factor names, and function names.</Item>
        <Item label="Error underlines">Red underlines mark parse/type errors. Hover for the message.</Item>
        <Item label="Diagnostics panel">Errors and warnings appear below the editor in red/yellow.</Item>
      </Section>
      <Section title="Right panel — Player table">
        <Item label="Columns">Base columns (name, position, team, price) plus one column per defined factor.</Item>
        <Item label="Sort">Click any column header to sort. Click again to reverse. Default: last factor descending.</Item>
        <Item label="Filter chips">Narrow the table to a preset player shortlist. One preset active at a time. Player count shown on the right.</Item>
      </Section>
      <Section title="Library drawer">
        <Item label="Save">Name your factor set and click Save (or press Enter) to pin it permanently.</Item>
        <Item label="History tab">Auto-saved snapshots (up to 20) — your work is never lost even if you forget to save.</Item>
        <Item label="Download ↓">Export a library as a .factors file for sharing or committing to the repo.</Item>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={styles.h4}>{title}</h4>
      <dl style={styles.dl}>{children}</dl>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={styles.dt}>{label}</dt>
      <dd style={styles.dd}>{children}</dd>
    </>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code style={styles.code}>{children}</code>;
}

// ── Functions & operators ─────────────────────────────────────────────────────

function FunctionsRef() {
  return (
    <div style={styles.content}>
      <h3 style={styles.h3}>Language reference</h3>

      <h4 style={styles.h4}>Factor syntax</h4>
      <pre style={styles.pre}>{`name = expression       # define a factor
# comment to end of line`}</pre>

      <h4 style={styles.h4}>Operators</h4>
      <table style={styles.table}>
        <tbody>
          {[
            ['+  -  *  /  ^', 'Arithmetic (null propagates)'],
            ['== != < <= > >=', 'Comparison (returns 1 or 0)'],
            ['-expr', 'Unary negation'],
          ].map(([op, desc]) => (
            <tr key={op}>
              <td style={styles.tdCode}>{op}</td>
              <td style={styles.tdDesc}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={styles.h4}>Scalar functions</h4>
      <table style={styles.table}>
        <tbody>
          {[
            ['iff(cond, then, else)', 'Conditional — null cond → null'],
            ['coalesce(a, b, …)',     'First non-null argument'],
            ['per90(stat, minutes)',  'Rate per 90 minutes'],
            ['min(a, b) / max(a, b)','Minimum / maximum'],
            ['abs(x)',               'Absolute value'],
            ['sqrt(x)',              'Square root'],
            ['log(x)',               'Natural logarithm'],
            ['exp(x)',               'e^x'],
            ['pow(base, exp)',       'Power'],
            ['round/floor/ceil(x)', 'Rounding'],
            ['clamp(x, lo, hi)',    'Clamp to range'],
            ['isnull(x)',           '1 if null, else 0'],
            ['notnull(x)',          '1 if not null, else 0'],
            ['goal_points(pos)',    'FPL goal points by position'],
            ['cs_points(pos)',      'Clean sheet points by position'],
            ['assist_points',       'Constant: 3 (all positions)'],
          ].map(([fn, desc]) => (
            <tr key={fn}>
              <td style={styles.tdCode}>{fn}</td>
              <td style={styles.tdDesc}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={styles.h4}>Cross-sectional functions (whole-column)</h4>
      <table style={styles.table}>
        <tbody>
          {[
            ['z(expr) / zscore(expr)',       'Population z-score'],
            ['rank(expr)',                   'Percentile rank [0,1]'],
            ['rank(expr, group)',            'Rank within group (e.g. position)'],
            ['quantile(expr) / scale(expr)', 'Min-max scaling [0,1]'],
            ['demean(expr)',                 'Subtract group mean'],
          ].map(([fn, desc]) => (
            <tr key={fn}>
              <td style={styles.tdCode}>{fn}</td>
              <td style={styles.tdDesc}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Fields ────────────────────────────────────────────────────────────────────

function FieldsRef({ fields }: { fields: FieldDef[] }) {
  return (
    <div style={styles.content}>
      <h3 style={styles.h3}>Field catalog ({fields.length} fields)</h3>
      <table style={{ ...styles.table, width: '100%' }}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Unit</th>
            <th style={styles.th}>Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(f => (
            <tr key={f.name}>
              <td style={styles.tdCode}>{f.name}</td>
              <td style={styles.tdDesc}>{f.type}</td>
              <td style={styles.tdDesc}>{f.unit ?? '—'}</td>
              <td style={styles.tdDesc}>{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Examples ──────────────────────────────────────────────────────────────────

function ExamplesTab({ examples, onLoad }: { examples: Example[]; onLoad: (t: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null);

  if (examples.length === 0) {
    return (
      <div style={styles.content}>
        <p style={{ color: '#9ca3af' }}>No examples found. Run <code>npm run bake</code> to generate them.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* List */}
      <div style={{ width: 180, borderRight: '1px solid #e5e7eb', overflowY: 'auto', flexShrink: 0 }}>
        {examples.map((ex, i) => (
          <button
            key={ex.name}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 12px', border: 'none', background: selected === i ? '#e0e7ff' : 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: selected === i ? 600 : 400,
              color: selected === i ? '#4f46e5' : '#374151',
            }}
            onClick={() => setSelected(i)}
          >
            {ex.name}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected !== null && examples[selected] ? (
          <>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{examples[selected].name}.factors</span>
              <button
                style={{ padding: '4px 12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                onClick={() => onLoad(examples[selected]!.text)}
              >
                Load into editor
              </button>
            </div>
            <pre style={{ flex: 1, overflowY: 'auto', margin: 0, padding: '10px 14px', fontSize: 12, lineHeight: 1.6, color: '#374151', background: '#f9fafb' }}>
              {examples[selected].text}
            </pre>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af', fontSize: 13 }}>
            Select an example to preview
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  drawer:   { display: 'flex', flexDirection: 'column', height: '100%' },
  tabs:     { display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0 },
  tab:      { padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' },
  tabActive:{ borderBottom: '2px solid #4f46e5', color: '#4f46e5', fontWeight: 600 },
  body:     { flex: 1, overflow: 'hidden' },
  content:  { padding: '12px 16px', overflowY: 'auto', height: '100%' },
  h3:       { margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' },
  h4:       { margin: '16px 0 6px', fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' },
  dl:       { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px', margin: 0 },
  dt:       { fontWeight: 600, fontSize: 12, color: '#4f46e5', paddingTop: 1 },
  dd:       { margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.5 },
  pre:      { background: '#f3f4f6', padding: '8px 12px', borderRadius: 6, fontSize: 12, margin: '0 0 8px', overflowX: 'auto' },
  code:     { background: '#f3f4f6', padding: '1px 4px', borderRadius: 3, fontSize: 11, fontFamily: 'monospace' },
  table:    { borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 },
  th:       { padding: '4px 10px', background: '#f3f4f6', borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontWeight: 600, color: '#374151' },
  tdCode:   { padding: '3px 10px', fontFamily: 'monospace', color: '#7c3aed', verticalAlign: 'top', whiteSpace: 'nowrap' },
  tdDesc:   { padding: '3px 10px', color: '#374151', verticalAlign: 'top' },
};
