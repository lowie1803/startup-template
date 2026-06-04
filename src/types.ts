/**
 * Shared primitive types used across the engine and the public API.
 * Engine modules import from this file to avoid circular deps with index.ts.
 */

/** Character range within the source text — carried by every token and AST node. */
export interface SourceSpan {
  from: number;
  to: number;
}

/** A diagnostic produced by the parse, sema, or runtime phases. */
export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning';
  from: number;
  to: number;
}

/** A single field available in the player panel (base data or a prior factor). */
export interface FieldDef {
  name: string;
  type: 'number' | 'string' | 'bool';
  description?: string;
}
