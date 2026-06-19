/**
 * DataSource registry — backlog item 021.
 *
 * Provides a central store for registered DataSource instances and exposes a
 * merged catalog (union of all sources' field declarations) for sema and
 * autocomplete.
 */

import type { FieldDef } from '../types.js';
import type { DataSource } from './types.js';

export class SourceRegistry {
  private readonly sources: Map<string, DataSource> = new Map();

  /**
   * Register a DataSource.
   * Throws if a source with the same id has already been registered.
   */
  register(source: DataSource): void {
    if (this.sources.has(source.id)) {
      throw new Error(`DataSource '${source.id}' is already registered`);
    }
    this.sources.set(source.id, source);
  }

  /** Look up a registered source by id. Returns undefined if not found. */
  get(id: string): DataSource | undefined {
    return this.sources.get(id);
  }

  /** Whether a source with the given id is registered. */
  has(id: string): boolean {
    return this.sources.has(id);
  }

  /** All registered sources in insertion order. */
  list(): DataSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Union of all registered sources' fields, in source-insertion order.
   * Fields from the first registered source appear first.
   */
  mergedFields(): FieldDef[] {
    const result: FieldDef[] = [];
    for (const source of this.sources.values()) {
      result.push(...source.fields);
    }
    return result;
  }

  /** Set of all registered source ids. */
  sourceIds(): Set<string> {
    return new Set(this.sources.keys());
  }
}

/** Singleton registry — the default instance used by the runtime. */
export const sourceRegistry = new SourceRegistry();
