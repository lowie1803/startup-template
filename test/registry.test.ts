/**
 * Tests for src/sources/registry.ts — backlog item 021.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SourceRegistry } from '../src/sources/registry.js';
import type { DataSource } from '../src/sources/types.js';
import type { FieldDef } from '../src/types.js';
import { Panel } from '../src/runtime/panel.js';

// ── Minimal stub DataSource factory ───────────────────────────────────────────

function makeStub(id: string, fieldNames: string[]): DataSource {
  const fields: FieldDef[] = fieldNames.map(name => ({
    name,
    source: id,
    type: 'number' as const,
    description: `Stub field ${name}`,
    fill: { kind: 'none' as const },
  }));
  return {
    id,
    fields,
    load: () => new Panel(0),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SourceRegistry', () => {
  let registry: SourceRegistry;

  beforeEach(() => {
    registry = new SourceRegistry();
  });

  it('can register a source and look it up', () => {
    const stub = makeStub('alpha', ['xg', 'xa']);
    registry.register(stub);
    expect(registry.has('alpha')).toBe(true);
    expect(registry.get('alpha')).toBe(stub);
  });

  it('get() returns undefined for an unregistered id', () => {
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.has('missing')).toBe(false);
  });

  it('registering the same id twice throws', () => {
    registry.register(makeStub('dup', []));
    expect(() => registry.register(makeStub('dup', []))).toThrow("DataSource 'dup' is already registered");
  });

  it('list() returns all registered sources in insertion order', () => {
    const a = makeStub('a', []);
    const b = makeStub('b', []);
    registry.register(a);
    registry.register(b);
    expect(registry.list()).toEqual([a, b]);
  });

  it('mergedFields() returns union of all sources\' fields', () => {
    registry.register(makeStub('src1', ['f1', 'f2']));
    registry.register(makeStub('src2', ['f3']));
    const merged = registry.mergedFields();
    const names = merged.map(f => f.name);
    expect(names).toEqual(['f1', 'f2', 'f3']);
  });

  it('mergedFields() returns empty array when no sources registered', () => {
    expect(registry.mergedFields()).toEqual([]);
  });

  it('sourceIds() returns the correct set of registered ids', () => {
    registry.register(makeStub('x', []));
    registry.register(makeStub('y', []));
    const ids = registry.sourceIds();
    expect(ids.has('x')).toBe(true);
    expect(ids.has('y')).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('sourceIds() returns empty set when nothing registered', () => {
    expect(registry.sourceIds().size).toBe(0);
  });
});
