/**
 * Static function signature catalog for the fplang sema phase.
 *
 * This is the single source of truth for:
 *   - Which identifiers are valid function calls (vs unknown)
 *   - The evaluation class of each function (scalar / xs / ts)
 *   - Arity bounds used by the typecheck pass
 *   - Which functions require a series() first argument
 *
 * Intentionally separate from src/runtime/builtins.ts, which only contains
 * functions implemented in the scalar runtime (Tier 1). This catalog covers
 * the full documented language including Tier 2 (XS) and Tier 3 (TS) functions
 * that are not yet runtime-implemented.
 */

/** Evaluation class from the function's own semantics. */
export type FnClass = 'scalar' | 'xs' | 'ts' | 'position';

export interface FnSig {
  name: string;
  fnClass: FnClass;
  /** Minimum number of arguments. */
  minArgs: number;
  /** Maximum number of arguments (Infinity = variadic). */
  maxArgs: number;
  /**
   * If true, the first argument must be a series(field) call.
   * Used by typecheck to enforce ts_* usage rules.
   */
  firstArgSeries?: boolean;
}

// ── Scalar helpers ────────────────────────────────────────────────────────────

const SCALAR_SIGS: FnSig[] = [
  { name: 'iff',        fnClass: 'scalar', minArgs: 3, maxArgs: 3 },
  { name: 'coalesce',   fnClass: 'scalar', minArgs: 2, maxArgs: Infinity },
  { name: 'clamp',      fnClass: 'scalar', minArgs: 3, maxArgs: 3 },
  { name: 'isnull',     fnClass: 'scalar', minArgs: 1, maxArgs: 1 },
  { name: 'notnull',    fnClass: 'scalar', minArgs: 1, maxArgs: 1 },
  { name: 'per90',      fnClass: 'scalar', minArgs: 2, maxArgs: 2 },
  { name: 'abs',        fnClass: 'scalar', minArgs: 1, maxArgs: 1 },
  { name: 'ceil',       fnClass: 'scalar', minArgs: 1, maxArgs: 1 },
  { name: 'floor',      fnClass: 'scalar', minArgs: 1, maxArgs: 1 },
  { name: 'round',      fnClass: 'scalar', minArgs: 1, maxArgs: 1 },
  { name: 'sqrt',       fnClass: 'scalar', minArgs: 1, maxArgs: 1 },
  { name: 'log',        fnClass: 'scalar', minArgs: 1, maxArgs: 1 },
  { name: 'exp',        fnClass: 'scalar', minArgs: 1, maxArgs: 1 },
  { name: 'pow',        fnClass: 'scalar', minArgs: 2, maxArgs: 2 },
  { name: 'min',        fnClass: 'scalar', minArgs: 2, maxArgs: 2 },
  { name: 'max',        fnClass: 'scalar', minArgs: 2, maxArgs: 2 },
];

// ── Position helpers ──────────────────────────────────────────────────────────

const POSITION_SIGS: FnSig[] = [
  { name: 'goal_points', fnClass: 'position', minArgs: 1, maxArgs: 1 },
  { name: 'cs_points',   fnClass: 'position', minArgs: 1, maxArgs: 1 },
];

// ── Cross-sectional operators ─────────────────────────────────────────────────

const XS_SIGS: FnSig[] = [
  { name: 'rank',     fnClass: 'xs', minArgs: 1, maxArgs: 2 },
  { name: 'zscore',   fnClass: 'xs', minArgs: 1, maxArgs: 2 },
  { name: 'z',        fnClass: 'xs', minArgs: 1, maxArgs: 2 },
  { name: 'quantile', fnClass: 'xs', minArgs: 1, maxArgs: 2 },
  { name: 'scale',    fnClass: 'xs', minArgs: 1, maxArgs: 2 },
  { name: 'demean',   fnClass: 'xs', minArgs: 1, maxArgs: 2 },
];

// ── Time-series operators ─────────────────────────────────────────────────────

const TS_SIGS: FnSig[] = [
  { name: 'ts_mean',  fnClass: 'ts', minArgs: 2, maxArgs: 2, firstArgSeries: true },
  { name: 'ts_delta', fnClass: 'ts', minArgs: 2, maxArgs: 2, firstArgSeries: true },
  { name: 'ts_sum',   fnClass: 'ts', minArgs: 2, maxArgs: 2, firstArgSeries: true },
  { name: 'ts_std',   fnClass: 'ts', minArgs: 2, maxArgs: 2, firstArgSeries: true },
  { name: 'ts_max',   fnClass: 'ts', minArgs: 2, maxArgs: 2, firstArgSeries: true },
  { name: 'ts_min',   fnClass: 'ts', minArgs: 2, maxArgs: 2, firstArgSeries: true },
];

/**
 * series(fieldName) — valid ONLY as the first argument of a ts_* call.
 * Listed here so the typecheck pass knows it's a real function (not unknown)
 * and can then enforce the positional constraint.
 */
const SERIES_SIG: FnSig = { name: 'series', fnClass: 'scalar', minArgs: 1, maxArgs: 1 };

// ── Combined catalog ──────────────────────────────────────────────────────────

export const FN_CATALOG: FnSig[] = [
  ...SCALAR_SIGS,
  ...POSITION_SIGS,
  ...XS_SIGS,
  ...TS_SIGS,
  SERIES_SIG,
];

/** Lookup by name — O(1). */
export const FN_MAP: ReadonlyMap<string, FnSig> = new Map(
  FN_CATALOG.map(sig => [sig.name, sig]),
);

/** Names of all cross-sectional functions. */
export const XS_FUNCS: ReadonlySet<string> = new Set(XS_SIGS.map(s => s.name));

/** Names of all time-series functions. */
export const TS_FUNCS: ReadonlySet<string> = new Set(TS_SIGS.map(s => s.name));

/**
 * Bare-identifier constants (not function calls).
 * `assist_points` is a constant = 3, per docs/04-functions.md.
 */
export const KNOWN_CONSTANTS: ReadonlySet<string> = new Set(['assist_points']);
