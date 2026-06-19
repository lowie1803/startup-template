/**
 * Tests for src/validate.ts — dataset well-formedness validator.
 * Covers all 5 rules: schema, names, shape, density, range.
 */

import { describe, it, expect } from 'vitest';
import { validateDataset } from '../src/validate.js';
import { applyFills } from '../src/sources/fill.js';
import { Panel } from '../src/runtime/panel.js';
import type { FieldDef } from '../src/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function field(overrides: Partial<FieldDef> & { name: string }): FieldDef {
  return {
    source: 'test',
    type: 'number',
    description: 'A test field',
    fill: { kind: 'none' },
    ...overrides,
  };
}

function makePanel(cols: Record<string, Float64Array | string[]>): Panel {
  const len = Object.values(cols)[0]?.length ?? 0;
  return new Panel(len, cols);
}

/** A minimal valid panel: id + one field, fully dense. */
function validPanel(): { fields: FieldDef[]; panel: Panel } {
  return {
    fields: [
      field({ name: 'id', type: 'number', description: 'FPL element ID', fill: { kind: 'none' } }),
      field({ name: 'price', type: 'number', description: 'Price', fill: { kind: 'none' }, range: [0, 20] }),
    ],
    panel: makePanel({
      id:    new Float64Array([1, 2, 3]),
      price: new Float64Array([5.0, 6.5, 10.0]),
    }),
  };
}

function errorCodes(fields: FieldDef[], panel: Panel): string[] {
  return validateDataset(fields, panel).errors.map(e => e.code);
}

// ── Happy path ────────────────────────────────────────────────────────────────

describe('valid dataset passes', () => {
  it('valid schema + dense panel → ok: true, no errors', () => {
    const { fields, panel } = validPanel();
    const report = validateDataset(fields, panel);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });
});

// ── Rule 1: Schema completeness ───────────────────────────────────────────────

describe('Rule 1 — schema completeness', () => {
  it('missing description → SCHEMA_MISSING_DESCRIPTION', () => {
    const { fields, panel } = validPanel();
    (fields[1] as any).description = '';
    expect(errorCodes(fields, panel)).toContain('SCHEMA_MISSING_DESCRIPTION');
  });

  it('missing fill → SCHEMA_MISSING_FILL', () => {
    const { fields, panel } = validPanel();
    delete (fields[1] as any).fill;
    expect(errorCodes(fields, panel)).toContain('SCHEMA_MISSING_FILL');
  });

  it('mean fill on string field → SCHEMA_INVALID_FILL_FOR_STRING', () => {
    const { panel } = validPanel();
    const fields = [
      field({ name: 'id',   type: 'number', description: 'ID', fill: { kind: 'none' } }),
      field({ name: 'name', type: 'string', description: 'Name', fill: { kind: 'mean' } }),
    ];
    const p2 = makePanel({ id: new Float64Array([1, 2]), name: ['A', 'B'] });
    expect(errorCodes(fields, p2)).toContain('SCHEMA_INVALID_FILL_FOR_STRING');
  });
});

// ── Rule 2: Name well-formedness ──────────────────────────────────────────────

describe('Rule 2 — name well-formedness', () => {
  it('name starting with uppercase → NAME_INVALID', () => {
    const { panel } = validPanel();
    const fields = [
      field({ name: 'id',    type: 'number', description: 'ID',    fill: { kind: 'none' } }),
      field({ name: 'Price', type: 'number', description: 'Price', fill: { kind: 'none' } }),
    ];
    const p2 = makePanel({ id: new Float64Array([1]), Price: new Float64Array([5.0]) });
    expect(errorCodes(fields, p2)).toContain('NAME_INVALID');
  });

  it('name colliding with a function → NAME_RESERVED', () => {
    const { panel } = validPanel();
    const fields = [
      field({ name: 'id',   type: 'number', description: 'ID',   fill: { kind: 'none' } }),
      field({ name: 'rank', type: 'number', description: 'Rank', fill: { kind: 'none' } }),
    ];
    const p2 = makePanel({ id: new Float64Array([1]), rank: new Float64Array([1]) });
    expect(errorCodes(fields, p2)).toContain('NAME_RESERVED');
  });

  it('duplicate name within same source → NAME_DUPLICATE_IN_SOURCE', () => {
    const fields = [
      field({ name: 'id',    type: 'number', description: 'ID',    fill: { kind: 'none' } }),
      field({ name: 'price', type: 'number', description: 'Price', fill: { kind: 'none' } }),
      field({ name: 'price', type: 'number', description: 'Price again', fill: { kind: 'none' } }),
    ];
    const p = makePanel({ id: new Float64Array([1]), price: new Float64Array([5]) });
    expect(errorCodes(fields, p)).toContain('NAME_DUPLICATE_IN_SOURCE');
  });
});

// ── Rule 3: Shape ─────────────────────────────────────────────────────────────

describe('Rule 3 — shape', () => {
  it('declared field missing from panel → SHAPE_MISSING_COLUMN', () => {
    const fields = [
      field({ name: 'id',    type: 'number', description: 'ID',    fill: { kind: 'none' } }),
      field({ name: 'price', type: 'number', description: 'Price', fill: { kind: 'none' } }),
    ];
    const p = makePanel({ id: new Float64Array([1, 2]) }); // no price column
    expect(errorCodes(fields, p)).toContain('SHAPE_MISSING_COLUMN');
  });

  it('missing id column → SHAPE_MISSING_ID', () => {
    const fields = [field({ name: 'price', type: 'number', description: 'Price', fill: { kind: 'none' } })];
    const p = makePanel({ price: new Float64Array([5]) });
    expect(errorCodes(fields, p)).toContain('SHAPE_MISSING_ID');
  });

  it('non-integer id value → SHAPE_ID_NOT_INTEGER', () => {
    const fields = [field({ name: 'id', type: 'number', description: 'ID', fill: { kind: 'none' } })];
    const p = makePanel({ id: new Float64Array([1.5, 2]) });
    expect(errorCodes(fields, p)).toContain('SHAPE_ID_NOT_INTEGER');
  });

  it('duplicate id value → SHAPE_ID_NOT_UNIQUE', () => {
    const fields = [field({ name: 'id', type: 'number', description: 'ID', fill: { kind: 'none' } })];
    const p = makePanel({ id: new Float64Array([1, 1]) });
    expect(errorCodes(fields, p)).toContain('SHAPE_ID_NOT_UNIQUE');
  });

  it('type mismatch: string field but Float64Array column → SHAPE_TYPE_MISMATCH', () => {
    const fields = [
      field({ name: 'id',   type: 'number', description: 'ID',   fill: { kind: 'none' } }),
      field({ name: 'name', type: 'string', description: 'Name', fill: { kind: 'none' } }),
    ];
    const p = makePanel({
      id:   new Float64Array([1]),
      name: new Float64Array([0]), // wrong type
    });
    expect(errorCodes(fields, p)).toContain('SHAPE_TYPE_MISMATCH');
  });
});

// ── Rule 4: Density ───────────────────────────────────────────────────────────

describe('Rule 4 — density', () => {
  it('NaN in numeric column → DENSITY_NAN', () => {
    const { fields } = validPanel();
    const p = makePanel({
      id:    new Float64Array([1, 2, 3]),
      price: new Float64Array([5.0, NaN, 10.0]),
    });
    expect(errorCodes(fields, p)).toContain('DENSITY_NAN');
  });

  it('Inf in numeric column → DENSITY_NAN', () => {
    const { fields } = validPanel();
    const p = makePanel({
      id:    new Float64Array([1, 2]),
      price: new Float64Array([5.0, Infinity]),
    });
    expect(errorCodes(fields, p)).toContain('DENSITY_NAN');
  });

  it('empty string in string column → DENSITY_EMPTY_STRING', () => {
    const fields = [
      field({ name: 'id',   type: 'number', description: 'ID',   fill: { kind: 'none' } }),
      field({ name: 'team', type: 'string', description: 'Team', fill: { kind: 'none' } }),
    ];
    const p = makePanel({ id: new Float64Array([1, 2]), team: ['ARS', ''] });
    expect(errorCodes(fields, p)).toContain('DENSITY_EMPTY_STRING');
  });

  it('density passes after applyFills', () => {
    const fields = [
      field({ name: 'id',  type: 'number', description: 'ID',  fill: { kind: 'none' } }),
      field({ name: 'cop', type: 'number', description: 'Chance', fill: { kind: 'constant', value: 100 } }),
    ];
    const raw = makePanel({
      id:  new Float64Array([1, 2, 3]),
      cop: new Float64Array([75, NaN, NaN]),
    });
    const dense = applyFills(raw, fields);
    const report = validateDataset(fields, dense);
    expect(report.ok).toBe(true);
    expect(report.errors.filter(e => e.code === 'DENSITY_NAN')).toHaveLength(0);
  });
});

// ── Rule 5: Range (warnings) ──────────────────────────────────────────────────

describe('Rule 5 — range warnings', () => {
  it('value outside declared range → RANGE_VIOLATION warning (not error)', () => {
    const fields = [
      field({ name: 'id',    type: 'number', description: 'ID',    fill: { kind: 'none' } }),
      field({ name: 'price', type: 'number', description: 'Price', fill: { kind: 'none' }, range: [3, 20] }),
    ];
    const p = makePanel({
      id:    new Float64Array([1]),
      price: new Float64Array([999]), // way out of range
    });
    const report = validateDataset(fields, p);
    expect(report.errors.filter(e => e.code === 'RANGE_VIOLATION')).toHaveLength(0);
    expect(report.warnings.some(w => w.code === 'RANGE_VIOLATION')).toBe(true);
  });

  it('value within range → no RANGE_VIOLATION', () => {
    const { fields, panel } = validPanel();
    const report = validateDataset(fields, panel);
    expect(report.warnings.filter(w => w.code === 'RANGE_VIOLATION')).toHaveLength(0);
  });
});

// ── fpl source end-to-end ─────────────────────────────────────────────────────

describe('fpl source: well-formed after applyFills', () => {
  it('validateDataset(FPL_FIELDS, applyFills(loadSnapshot())) → ok: true', async () => {
    const { loadSnapshot } = await import('../data/loadSnapshot.js');
    const { FPL_FIELDS } = await import('../src/catalog/fields.js');
    const panel = loadSnapshot();
    const dense = applyFills(panel, FPL_FIELDS);
    const report = validateDataset(FPL_FIELDS, dense);

    // Print errors for debugging if any
    if (!report.ok) {
      for (const e of report.errors.slice(0, 5)) {
        console.error(`[${e.code}] ${e.field ?? ''}: ${e.message}`);
      }
    }
    expect(report.ok).toBe(true);
  });

  it('removing fdr fill → density error for fdr', async () => {
    const { loadSnapshot } = await import('../data/loadSnapshot.js');
    const { FPL_FIELDS } = await import('../src/catalog/fields.js');
    const panel = loadSnapshot();

    // Patch fdr fill to 'none' — simulating forgetting the fill
    const fieldsWithBrokenFdr = FPL_FIELDS.map(f =>
      f.name === 'fdr' ? { ...f, fill: { kind: 'none' as const } } : f
    );

    // applyFills with 'none' leaves NaN; validate should fail
    const dense = applyFills(panel, fieldsWithBrokenFdr);
    const report = validateDataset(fieldsWithBrokenFdr, dense);
    expect(report.ok).toBe(false);
    expect(report.errors.some(e => e.code === 'DENSITY_NAN' && e.field === 'fdr')).toBe(true);
  });
});
