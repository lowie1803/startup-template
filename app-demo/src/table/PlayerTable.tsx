import React, { useState, useMemo } from 'react';
import type { Panel } from 'fplang';

interface PlayerTableProps {
  panel: Panel;
  factorNames: string[];
  visibleRows?: Set<number> | null;
}

const DISPLAY_BASE = ['web_name', 'position', 'team', 'price'];

export function PlayerTable({ panel, factorNames, visibleRows }: PlayerTableProps) {
  const [sortCol, setSortCol]     = useState<string | null>(null);
  const [sortAsc, setSortAsc]     = useState(false);

  // Default sort: last factor desc (or web_name asc if no factors)
  const effectiveSortCol = sortCol ?? (factorNames[factorNames.length - 1] ?? 'web_name');
  const effectiveSortAsc = sortCol === null ? (factorNames.length === 0) : sortAsc;

  const cols = useMemo(() => [...DISPLAY_BASE, ...factorNames], [factorNames]);

  const rows = useMemo(() => {
    const indices = Array.from({ length: panel.rowCount }, (_, i) => i)
      .filter(i => visibleRows == null || visibleRows.has(i));
    return indices.sort((a, b) => {
      const va = panel.getValue(effectiveSortCol, a);
      const vb = panel.getValue(effectiveSortCol, b);
      // Nulls last
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb));
      return effectiveSortAsc ? cmp : -cmp;
    });
  }, [panel, effectiveSortCol, effectiveSortAsc]);

  function handleHeaderClick(col: string) {
    if (sortCol === col) {
      setSortAsc(a => !a);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  }

  function fmt(v: number | string | null): string {
    if (v === null) return '—';
    if (typeof v === 'number') return v.toFixed(3).replace(/\.?0+$/, '');
    return v;
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr>
            {cols.map(col => (
              <th
                key={col}
                style={{
                  ...styles.th,
                  ...(col === effectiveSortCol ? styles.thActive : {}),
                }}
                onClick={() => handleHeaderClick(col)}
              >
                {col}
                {col === effectiveSortCol ? (effectiveSortAsc ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(i => (
            <tr key={i} style={styles.tr}>
              {cols.map(col => (
                <td key={col} style={styles.td}>
                  {fmt(panel.getValue(col, i))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { flex: 1, overflowY: 'auto', overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { padding: '8px 12px', background: '#f3f4f6', borderBottom: '2px solid #e5e7eb', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' },
  thActive:  { background: '#e0e7ff', color: '#4f46e5' },
  tr:        { borderBottom: '1px solid #f3f4f6' },
  td:        { padding: '6px 12px', whiteSpace: 'nowrap' },
};
