import { describe, it, expect } from 'vitest';
import { parse, analyze, evaluate, listFields, Panel } from '../src/index.js';
import { buildSamplePanel } from '../data/sample-panel.js';

describe('public API contract', () => {
  it('exports the four public functions', () => {
    expect(typeof parse).toBe('function');
    expect(typeof analyze).toBe('function');
    expect(typeof evaluate).toBe('function');
    expect(typeof listFields).toBe('function');
  });

  // ── listFields() ──────────────────────────────────────────────────────────

  it('listFields() returns a non-empty array', () => {
    const fields = listFields();
    expect(Array.isArray(fields)).toBe(true);
    expect(fields.length).toBeGreaterThan(0);
  });

  it('listFields() includes key FPL fields', () => {
    const names = listFields().map(f => f.name);
    for (const name of ['total_points', 'price', 'minutes', 'position', 'form']) {
      expect(names).toContain(name);
    }
  });

  it('listFields() entries have required shape', () => {
    for (const f of listFields()) {
      expect(typeof f.name).toBe('string');
      expect(['number', 'string', 'bool']).toContain(f.type);
    }
  });

  // ── parse() ────────────────────────────────────────────────────────────────

  it('parse() returns defs and diagnostics', () => {
    const result = parse('value = total_points / price');
    expect(Array.isArray(result.defs)).toBe(true);
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.defs).toHaveLength(1);
    expect(result.defs[0]?.name).toBe('value');
  });

  it('parse() returns empty defs and diagnostics for empty input', () => {
    const result = parse('');
    expect(result.defs).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('parse() does not throw on syntax errors — returns diagnostics', () => {
    expect(() => parse('123 bad input @@')).not.toThrow();
    const result = parse('123 bad input @@');
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  // ── analyze() ─────────────────────────────────────────────────────────────

  it('analyze() returns required shape', () => {
    const result = analyze('value = total_points / price', listFields());
    expect(Array.isArray(result.order)).toBe(true);
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(typeof result.classifications).toBe('object');
    expect(typeof result.hoverMap).toBe('object');
    expect(Array.isArray(result.completions)).toBe(true);
  });

  it('analyze() lists defined factors in order', () => {
    const result = analyze('a = 1\nb = 2', listFields());
    expect(result.order).toEqual(['a', 'b']);
    expect(result.classifications['a']).toBe('scalar');
    expect(result.classifications['b']).toBe('scalar');
  });

  it('analyze() includes field names in completions', () => {
    const result = analyze('', listFields());
    expect(result.completions).toContain('total_points');
    expect(result.completions).toContain('price');
  });

  // ── evaluate() ────────────────────────────────────────────────────────────

  it('evaluate() returns panel, factorNames, diagnostics', () => {
    const panel = buildSamplePanel();
    const result = evaluate('value = total_points / price', panel, listFields());
    expect(result.panel).toBeDefined();
    expect(Array.isArray(result.factorNames)).toBe(true);
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.factorNames).toContain('value');
  });

  it('evaluate() adds the factor as a column', () => {
    const panel = buildSamplePanel();
    const result = evaluate('value = total_points / price', panel, listFields());
    expect(result.panel.has('value')).toBe(true);
  });

  it('evaluate() does not mutate the input panel', () => {
    const panel = buildSamplePanel();
    const colsBefore = panel.columnNames().length;
    evaluate('value = total_points / price', panel, listFields());
    expect(panel.columnNames().length).toBe(colsBefore);
  });

  it('evaluate() produces no errors for valid factor text', () => {
    const panel = buildSamplePanel();
    const result = evaluate(
      'value = total_points / price\nnailed = iff(minutes > 1500, 1, 0)',
      panel,
      listFields(),
    );
    expect(result.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('Panel is exported and constructable', () => {
    const p = new Panel(2, {
      x: new Float64Array([1, 2]),
    });
    expect(p.rowCount).toBe(2);
    expect(p.has('x')).toBe(true);
  });
});
