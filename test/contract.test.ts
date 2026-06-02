import { describe, it, expect } from 'vitest';
import { parse, analyze, evaluate, listFields } from '../src/index.js';

describe('public API contract', () => {
  it('exports the four public functions', () => {
    expect(typeof parse).toBe('function');
    expect(typeof analyze).toBe('function');
    expect(typeof evaluate).toBe('function');
    expect(typeof listFields).toBe('function');
  });

  it('listFields() returns an array (safe empty stub)', () => {
    const fields = listFields();
    expect(Array.isArray(fields)).toBe(true);
    // Will grow as catalog/fields.ts is populated; zero is correct for now.
    expect(fields.length).toBe(0);
  });

  it('parse() throws "not yet implemented"', () => {
    expect(() => parse('value = total_points / price')).toThrow(
      'fplang engine not yet implemented',
    );
  });

  it('analyze() throws "not yet implemented"', () => {
    expect(() => analyze('value = total_points / price', [])).toThrow(
      'fplang engine not yet implemented',
    );
  });

  it('evaluate() throws "not yet implemented"', () => {
    expect(() => evaluate('value = total_points / price', {}, [])).toThrow(
      'fplang engine not yet implemented',
    );
  });
});
