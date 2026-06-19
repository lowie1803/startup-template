import React from 'react';
import { FILTER_PRESETS } from './filters.js';

interface FilterChipsProps {
  activeId: string;
  onChange: (id: string) => void;
  visibleCount: number | null;
  totalCount: number;
}

export function FilterChips({ activeId, onChange, visibleCount, totalCount }: FilterChipsProps) {
  const count = visibleCount ?? totalCount;

  return (
    <div style={styles.bar}>
      <div style={styles.chips}>
        {FILTER_PRESETS.map(p => (
          <button
            key={p.id}
            style={{
              ...styles.chip,
              ...(p.id === activeId ? styles.chipActive : {}),
            }}
            onClick={() => onChange(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <span style={styles.count}>
        {activeId === 'all'
          ? `${totalCount} players`
          : `${count} / ${totalCount} players`}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar:       { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', flexShrink: 0, flexWrap: 'wrap' },
  chips:     { display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 },
  chip:      { padding: '3px 10px', border: '1px solid #d1d5db', borderRadius: 99, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' },
  chipActive:{ background: '#4f46e5', borderColor: '#4f46e5', color: '#fff', fontWeight: 600 },
  count:     { fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' },
};
